import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LanguageService } from 'src/app/shared/services/language.service';
import { FlightStore } from '../../shared/flight.store';
import { FlightStatistic } from '../../shared/flightStatistic.model';
import { Flight } from '../../shared/flight.model';
import { SessionTeardownRegistry } from 'src/app/shared/services/session-teardown.registry';

/** 'all' or a four-digit year. */
export type StatisticPeriod = string;
export const ALL_TIME: StatisticPeriod = 'all';

export interface HeadlineStats {
    flights: number;
    /** Seconds. */
    airtime: number;
    /** Seconds. */
    average: number;
    /** Kilometres. */
    distance: number;
}

export interface HeatmapDay {
    date: Date;
    flights: number;
}

export interface CumulativePoint {
    label: string;
    /** Cumulative seconds up to and including this month. */
    seconds: number;
    /** Which season this month belongs to, so one can be highlighted. */
    year: string;
}

/** One season: the year, its totals, and flights per calendar month. */
export interface Season {
    year: string;
    flights: number;
    /** Seconds. */
    airtime: number;
    months: number[];
    /** The season's busiest month, so the sparkline does not re-derive it per bar. */
    monthMax: number;
}

export interface Bar {
    /** 0..1 of the tallest bar. */
    ratio: number;
    /** Nothing flown - the design draws a hairline rather than an empty slot. */
    empty: boolean;
    /** The tallest bar, which the design paints in the primary colour. */
    peak: boolean;
    label: string;
}

export interface SeasonRow {
    year: string;
    /** Twelve levels, 0..3, one per month. */
    cells: number[];
}

export interface SeasonComparison {
    flights: number;
    /** Against the previous season; null when this is the first. */
    delta: number | null;
    /** 1 = best season by flights. */
    rank: number;
    previousYear: string | null;
}

export interface PersonalBests {
    longestDistance: { km: number; date: string } | null;
    longestAirtime: { seconds: number; date: string } | null;
    startPlaces: number;
    landingPlaces: number;
}

export interface StatisticState {
    global: FlightStatistic | null;
    yearly: FlightStatistic[];
    monthly: FlightStatistic[];
    /** Every flight, fetched once per session and reused for every period. */
    flights: Flight[];
    loaded: boolean;
    /** FlightStore.revision this snapshot was taken at. */
    revision: number;
}

/** 'HH:mm:ss' from the API to seconds. */
function timeToSeconds(time?: string): number {
    if (!time) {
        return 0;
    }
    const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

/**
 * The design's four-level intensity scale, shared by both activity grids:
 * nothing, then thirds of the busiest cell.
 */
function shade(value: number, max: number): number {
    if (!value || max <= 0) {
        return 0;
    }
    const ratio = value / max;
    return ratio > 2 / 3 ? 3 : (ratio > 1 / 3 ? 2 : 1);
}

/**
 * Parses a YYYY-MM-DD flight date as local midnight. `new Date('2025-01-01')`
 * is parsed as UTC, so west of UTC it lands on the previous day - and since the
 * grid keys and compares with local date parts, the last day of a year fell off
 * the heatmap entirely.
 */
function localDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

@Injectable({
    providedIn: 'root'
})
export class StatisticStore {
    private flightStore = inject(FlightStore);
    private languageService = inject(LanguageService);

    private state = signal<StatisticState>({
        global: null,
        yearly: [],
        monthly: [],
        flights: [],
        loaded: false,
        revision: -1
    });

    constructor() {
        inject(SessionTeardownRegistry).register(() => this.clear());
    }

    /** Selected period: ALL_TIME or a year. */
    public period = signal<StatisticPeriod>(ALL_TIME);

    /**
     * False once the logbook or the shared filter has moved under us - the page
     * only reloads while this is false, so a flight logged (or a filter set on
     * the Flights tab) has to invalidate the cached figures.
     */
    public loaded = computed(() => this.state().loaded && this.state().revision === this.flightStore.revision());
    public hasFlights = computed(() => (this.state().global?.nbFlights ?? 0) > 0);

    /** Years with at least one flight, newest first. */
    public years = computed(() =>
        this.state().yearly
            .filter(row => Number(row.nbFlights) > 0)
            .map(row => row.year)
            .sort((a, b) => Number(b) - Number(a))
    );

    /** Date of the first flight, for the header eyebrow. */
    public firstFlightDate = computed<string | null>(() => {
        const dates = this.state().flights.map(f => f.date).filter(Boolean).sort();
        return dates.length ? dates[0] : null;
    });

    /**
     * Every season with its monthly breakdown, oldest first. The yearly rows
     * carry the totals and the monthly rows the shape; both are already loaded,
     * so nothing new is fetched for the grid, the bars or the seasons list.
     */
    public seasons = computed<Season[]>(() => {
        const monthly = this.state().monthly;
        return this.state().yearly
            .filter(row => Number(row.nbFlights) > 0)
            .sort((a, b) => Number(a.year) - Number(b.year))
            .map(row => {
                const months = Array(12).fill(0);
                for (const entry of monthly) {
                    if (entry.year !== row.year) {
                        continue;
                    }
                    const index = Number(entry.month) - 1;
                    if (index >= 0 && index < 12) {
                        months[index] = Number(entry.nbFlights ?? 0);
                    }
                }
                return {
                    year: row.year,
                    flights: Number(row.nbFlights ?? 0),
                    airtime: Number(row.time ?? 0),
                    months,
                    monthMax: Math.max(...months, 1)
                };
            });
    });

    private selectedSeason = computed<Season | null>(() =>
        this.seasons().find(season => season.year === this.period()) ?? null
    );

    /** How the selected season stands against the one before, and against all. */
    public comparison = computed<SeasonComparison | null>(() => {
        const season = this.selectedSeason();
        if (!season) {
            return null;
        }
        const seasons = this.seasons();
        const previous = seasons.find(s => Number(s.year) === Number(season.year) - 1) ?? null;
        const rank = [...seasons].sort((a, b) => b.flights - a.flights)
            .findIndex(s => s.year === season.year) + 1;
        return {
            flights: season.flights,
            delta: previous ? season.flights - previous.flights : null,
            rank,
            previousYear: previous?.year ?? null
        };
    });

    /** One bar per season all-time, one per month inside a season. */
    public bars = computed<Bar[]>(() => {
        const season = this.selectedSeason();
        if (season) {
            const max = season.monthMax;
            return season.months.map((value, index) => ({
                ratio: value / max,
                empty: value === 0,
                peak: value > 0 && value === max,
                label: this.monthInitials()[index]
            }));
        }

        const seasons = this.seasons();
        const max = Math.max(...seasons.map(s => s.flights), 1);
        return seasons.map((s, index) => ({
            ratio: s.flights / max,
            empty: s.flights === 0,
            peak: s.flights === max,
            // Only the ends and every fifth year, or the axis turns to mush.
            label: (index === 0 || index === seasons.length - 1 || Number(s.year) % 5 === 0)
                ? `’${s.year.slice(2)}`
                : ''
        }));
    });

    /** The busiest month of the season, or the strongest season all-time. */
    public peakLabel = computed<{ name: string; flights: number } | null>(() => {
        const season = this.selectedSeason();
        if (season) {
            const max = Math.max(...season.months);
            return max > 0
                ? { name: this.monthNames()[season.months.indexOf(max)], flights: max }
                : null;
        }
        const best = [...this.seasons()].sort((a, b) => b.flights - a.flights)[0];
        return best ? { name: best.year, flights: best.flights } : null;
    });

    /** Newest season first, as the design stacks them. */
    public seasonGrid = computed<SeasonRow[]>(() => {
        const seasons = this.seasons();
        const max = Math.max(...seasons.flatMap(s => s.months), 1);
        return [...seasons].reverse().map(season => ({
            year: `’${season.year.slice(2)}`,
            cells: season.months.map(value => shade(value, max))
        }));
    });

    /** Months of the selected season that saw at least one flight. */
    public activeMonths = computed(() =>
        this.selectedSeason()?.months.filter(value => value > 0).length ?? 0
    );

    /** Localised month names and their initials, for the bars and the grid. */
    public monthNames = computed<string[]>(() => {
        const formatter = new Intl.DateTimeFormat(this.languageService.lang(), { month: 'long' });
        return Array.from({ length: 12 }, (_unused, index) => formatter.format(new Date(2020, index, 1)));
    });

    public monthInitials = computed<string[]>(() =>
        this.monthNames().map(name => name.charAt(0).toUpperCase())
    );

    /** Flights inside the selected period. */
    private periodFlights = computed<Flight[]>(() => {
        const period = this.period();
        const flights = this.state().flights;
        return period === ALL_TIME ? flights : flights.filter(f => f.date?.startsWith(period));
    });

    public headline = computed<HeadlineStats>(() => {
        const period = this.period();

        // All-time comes from the authoritative global aggregate; a single year
        // comes from its yearly row. Both arrive with numeric fields as strings.
        const row = period === ALL_TIME
            ? this.state().global
            : this.state().yearly.find(y => y.year === period) ?? null;

        const flights = Number(row?.nbFlights ?? 0);
        const airtime = Number(row?.time ?? 0);
        return {
            flights,
            airtime,
            average: Number(row?.average ?? 0),
            distance: Number(row?.totalDistance ?? 0)
        };
    });

    /**
     * One entry per day: from the first flight for all-time, the calendar year
     * for a selected year. All-time is what the design's "every day since you
     * started" describes; the grid compresses to fit rather than scrolling, so
     * a long logbook draws narrower columns instead of running off the card.
     */
    public heatmap = computed<HeatmapDay[]>(() => {
        const flights = this.periodFlights();
        if (flights.length === 0) {
            return [];
        }

        const counts = new Map<string, number>();
        for (const flight of flights) {
            if (flight.date) {
                counts.set(flight.date, (counts.get(flight.date) ?? 0) + 1);
            }
        }

        const period = this.period();
        const sorted = [...counts.keys()].sort();
        const today = new Date();

        // Flights can carry no date, so `flights` being non-empty does not mean
        // `counts` is - and the all-time window is anchored on its first key.
        if (period === ALL_TIME && sorted.length === 0) {
            return [];
        }

        const start: Date = period === ALL_TIME
            ? localDate(sorted[0])
            : new Date(Number(period), 0, 1);

        const end = period === ALL_TIME || Number(period) === today.getFullYear()
            ? today
            : new Date(Number(period), 11, 31);

        // Start on the Monday of the first week so the 7-row grid aligns.
        const cursor = new Date(start);
        const weekday = (cursor.getDay() + 6) % 7; // Mon = 0
        cursor.setDate(cursor.getDate() - weekday);

        const days: HeatmapDay[] = [];
        while (cursor <= end) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            days.push({ date: new Date(cursor), flights: counts.get(key) ?? 0 });
            cursor.setDate(cursor.getDate() + 1);
        }
        return days;
    });

    /** Running airtime total per month, for the cumulative chart. */
    public cumulative = computed<CumulativePoint[]>(() => {
        // Read as a signal so the axis labels re-render on a language switch.
        const lang = this.languageService.lang();
        // Always the whole logbook, whatever the period: the design puts the
        // selected season in context by highlighting its stretch of the line,
        // which a chart cut down to that season could not show.
        const rows = [...this.state().monthly]
            .sort((a, b) => (a.year + a.month).localeCompare(b.year + b.month));

        let running = 0;
        return rows.map(row => {
            running += Number(row.time ?? 0);
            // month arrives zero-padded as a string.
            const date = new Date(Number(row.year), Number(row.month) - 1, 1);
            return {
                label: date.toLocaleDateString(lang, { month: 'short', year: 'numeric' }),
                seconds: running,
                year: row.year
            };
        });
    });

    public bests = computed<PersonalBests>(() => {
        const flights = this.periodFlights();

        let longestDistance: { km: number; date: string } | null = null;
        let longestAirtime: { seconds: number; date: string } | null = null;
        const startPlaces = new Set<number>();
        const landingPlaces = new Set<number>();

        for (const flight of flights) {
            const km = Number(flight.km ?? 0);
            if (km > 0 && (!longestDistance || km > longestDistance.km)) {
                longestDistance = { km, date: flight.date };
            }

            const seconds = timeToSeconds(flight.time);
            if (seconds > 0 && (!longestAirtime || seconds > longestAirtime.seconds)) {
                longestAirtime = { seconds, date: flight.date };
            }

            if (flight.start?.id) {
                startPlaces.add(flight.start.id);
            }
            if (flight.landing?.id) {
                landingPlaces.add(flight.landing.id);
            }
        }

        return { longestDistance, longestAirtime, startPlaces: startPlaces.size, landingPlaces: landingPlaces.size };
    });

    /**
     * One load per session. Everything else is derived, so switching period
     * costs no requests.
     *
     * The shared flight filter applies here: this page has its own control for
     * it now, and a chip bar that says what is narrowing the numbers.
     */
    load(): Observable<StatisticState> {
        const global$: Observable<FlightStatistic[] | null> = this.flightStore.getStatistics('global').pipe(catchError(() => of(null)));
        const yearly$ = this.flightStore.getStatistics('yearly').pipe(catchError(() => of([] as FlightStatistic[])));
        const monthly$ = this.flightStore.getStatistics('monthly').pipe(catchError(() => of([] as FlightStatistic[])));
        const flights$ = this.flightStore.getFlights({ store: false }).pipe(catchError(() => of([] as Flight[])));

        return forkJoin([global$, yearly$, monthly$, flights$]).pipe(
            map(([global, yearly, monthly, flights]): StatisticState => ({
                global: global?.[0] ?? null,
                yearly: yearly ?? [],
                monthly: monthly ?? [],
                flights: flights ?? [],
                // A load where even the global aggregate failed is not loaded:
                // caching it would pin the empty state for the whole session,
                // because the page only refetches while `loaded` is false.
                loaded: global !== null,
                revision: this.flightStore.revision()
            })),
            tap(state => this.state.set(state))
        );
    }

    /**
     * Same request set, but past the once-per-session guard the page applies -
     * a filter change has to refetch even though the page never left.
     */
    reload(): Observable<StatisticState> {
        this.state.update(state => ({ ...state, loaded: false }));
        return this.load().pipe(
            tap(() => {
                // A filter can narrow the logbook to years the selected season
                // is not among. Left pointing at it, the headline reads 0/0/0
                // with no chip highlighted and no way back.
                const period = this.period();
                if (period !== ALL_TIME && !this.years().includes(period)) {
                    this.period.set(ALL_TIME);
                }
            })
        );
    }

    clear(): void {
        this.period.set(ALL_TIME);
        this.state.set({ global: null, yearly: [], monthly: [], flights: [], loaded: false, revision: -1 });
    }
}
