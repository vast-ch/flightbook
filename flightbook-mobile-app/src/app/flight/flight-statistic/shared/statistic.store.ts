import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LanguageService } from 'src/app/shared/services/language.service';
import { FlightStore } from '../../shared/flight.store';
import { FlightStatistic } from '../../shared/flightStatistic.model';
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
    /** Sum of the per-flight price. Unitless - the app models no currency. */
    income: number;
}

export interface HeatmapDay {
    date: Date;
    flights: number;
}

export interface CumulativePoint {
    label: string;
    /** Cumulative seconds up to and including this month. */
    seconds: number;
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
    /** Income for the season, and per calendar month. */
    income: number;
    incomeMonths: number[];
}

export interface Bar {
    /** The number behind the bar, for charts that print it above the column. */
    value: number;
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

export interface IncomeSummary {
    /** The period's total, from the authoritative aggregate row. */
    total: number;
    /** Flights in the period that carry a price. */
    paidFlights: number;
    /** total / paidFlights, or 0 when nothing in the period is priced. */
    perFlight: number;
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
    /** Day counts for a selected year, fetched lazily the first time it's shown. */
    daily: Map<string, HeatmapDay[]>;
    loaded: boolean;
    /** FlightStore.revision this snapshot was taken at. */
    revision: number;
}

/** 'YYYY-MM-DD', comparable against the API's date strings. */
function dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * The design's four-level intensity scale for the season grid: nothing, then
 * thirds of the busiest cell.
 *
 * The day heatmap deliberately does not share this - GitHub-style, its levels
 * are absolute counts (none / 1 / 2 / 3+), so one cell means the same thing
 * whatever else is in the logbook. See ActivityHeatmapComponent.cells.
 */
function shade(value: number, max: number): number {
    if (!value || max <= 0) {
        return 0;
    }
    const ratio = value / max;
    return ratio > 2 / 3 ? 3 : (ratio > 1 / 3 ? 2 : 1);
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
        daily: new Map(),
        loaded: false,
        revision: -1
    });

    /** Years currently being fetched, so a rapid re-select can't fire it twice. */
    private pendingDaily = new Set<string>();

    constructor() {
        inject(SessionTeardownRegistry).register(() => this.clear());

        // The day heatmap is only ever shown for one selected year (never
        // all-time - the season grid covers that), so this is at most one
        // small request per year the user actually opens, not a bulk fetch.
        effect(() => {
            const period = this.period();
            if (this.loaded() && period !== ALL_TIME) {
                this.ensureDaily(period);
            }
        });
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

    /** Earliest year with a flight, for the header eyebrow. */
    public firstFlightYear = computed<string | null>(() => {
        const years = this.years();
        return years.length ? years[years.length - 1] : null;
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
                const incomeMonths = Array(12).fill(0);
                for (const entry of monthly) {
                    if (entry.year !== row.year) {
                        continue;
                    }
                    const index = Number(entry.month) - 1;
                    if (index >= 0 && index < 12) {
                        months[index] = Number(entry.nbFlights ?? 0);
                        incomeMonths[index] = Number(entry.income ?? 0);
                    }
                }
                return {
                    year: row.year,
                    flights: Number(row.nbFlights ?? 0),
                    airtime: Number(row.time ?? 0),
                    months,
                    monthMax: Math.max(...months, 1),
                    income: Number(row.income ?? 0),
                    incomeMonths
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

    /**
     * Ratio against the tallest bar, with the peak marked. Shared by the flight
     * and income charts, which differ only in the numbers they are given.
     */
    private toBars(values: number[], label: (index: number) => string): Bar[] {
        // Seeded only when nothing was recorded, not floored at 1: the income
        // charts share this and their values are decimals, so a flat `, 1`
        // mis-scaled every bar and left `peak` matching nothing.
        const highest = Math.max(...values, 0);
        const max = highest > 0 ? highest : 1;
        return values.map((value, index) => ({
            value,
            ratio: value / max,
            empty: value === 0,
            peak: value > 0 && value === max,
            label: label(index)
        }));
    }

    /** Only the ends and every fifth year, or the axis turns to mush. */
    private seasonLabel(seasons: Season[], index: number): string {
        const year = seasons[index].year;
        return (index === 0 || index === seasons.length - 1 || Number(year) % 5 === 0)
            ? `’${year.slice(2)}`
            : '';
    }

    /** One bar per season all-time, one per month inside a season. */
    public bars = computed<Bar[]>(() => {
        const season = this.selectedSeason();
        if (season) {
            const initials = this.monthInitials();
            return this.toBars(season.months, index => initials[index]);
        }

        const seasons = this.seasons();
        return this.toBars(seasons.map(s => s.flights), index => this.seasonLabel(seasons, index));
    });

    /**
     * Income per season, one bar each. Deliberately period-independent: the
     * point of the yearly view is the shape across seasons, and narrowing it to
     * the selected one would leave a single bar. Empty when nothing was priced,
     * so the chart can be left out rather than drawn as a row of hairlines.
     */
    public incomeByYear = computed<Bar[]>(() => {
        const seasons = this.seasons();
        const values = seasons.map(season => season.income);
        return values.some(value => value > 0)
            ? this.toBars(values, index => this.seasonLabel(seasons, index))
            : [];
    });

    /**
     * Income per calendar month, twelve bars. A selected season shows its own
     * months; all time sums every season onto one calendar, which answers
     * whether the flying is seasonal rather than how a single year went.
     */
    public incomeByMonth = computed<Bar[]>(() => {
        const season = this.selectedSeason();
        const months = season
            ? season.incomeMonths
            : this.seasons().reduce<number[]>(
                (totals, entry) => totals.map((total, index) => total + entry.incomeMonths[index]),
                Array(12).fill(0)
            );

        if (!months.some(value => value > 0)) {
            return [];
        }
        const initials = this.monthInitials();
        return this.toBars(months, index => initials[index]);
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

    /**
     * The aggregate row behind the selected period: the global row for
     * all-time, the matching yearly row for a single year. Both arrive with
     * numeric fields as strings. Shared by headline, bests and incomeSummary
     * so the all-time/yearly lookup isn't repeated three times.
     */
    private selectedStatRow = computed<FlightStatistic | null>(() => {
        const period = this.period();
        return period === ALL_TIME
            ? this.state().global
            : this.state().yearly.find(y => y.year === period) ?? null;
    });

    public headline = computed<HeadlineStats>(() => {
        const row = this.selectedStatRow();
        const flights = Number(row?.nbFlights ?? 0);
        const airtime = Number(row?.time ?? 0);
        return {
            flights,
            airtime,
            average: Number(row?.average ?? 0),
            distance: Number(row?.totalDistance ?? 0),
            income: Number(row?.income ?? 0)
        };
    });

    /**
     * Whether to offer the income section at all, judged on the whole logbook
     * rather than the selected period: price is optional per flight and most
     * pilots never fill it, and a section that appeared and vanished as you
     * moved between seasons would read as a glitch.
     */
    public hasIncome = computed(() => Number(this.state().global?.income ?? 0) > 0);

    /**
     * The total comes from the aggregate row, so it follows the shared filter;
     * paidFlights is a count the API now returns alongside it.
     */
    public incomeSummary = computed<IncomeSummary>(() => {
        const total = this.headline().income;
        const paidFlights = Number(this.selectedStatRow()?.paidFlights ?? 0);
        return { total, paidFlights, perFlight: paidFlights > 0 ? total / paidFlights : 0 };
    });

    /**
     * One entry per day of the selected year, Monday-aligned so the 7-row grid
     * lines up. Only ever read for a specific year - the template shows the
     * season grid instead of this for all-time - so `ensureDaily` only ever
     * requests a single calendar year, safely under the API's day-count cap.
     */
    public heatmap = computed<HeatmapDay[]>(() => {
        const period = this.period();
        if (period === ALL_TIME) {
            return [];
        }

        const rows = this.state().daily.get(period);
        if (!rows || rows.length === 0) {
            return [];
        }

        const counts = new Map<string, number>();
        for (const row of rows) {
            counts.set(dateKey(row.date), row.flights);
        }

        const today = new Date();
        const start = new Date(Number(period), 0, 1);
        const end = Number(period) === today.getFullYear() ? today : new Date(Number(period), 11, 31);

        // Start on the Monday of the first week so the 7-row grid aligns.
        const cursor = new Date(start);
        const weekday = (cursor.getDay() + 6) % 7; // Mon = 0
        cursor.setDate(cursor.getDate() - weekday);

        const days: HeatmapDay[] = [];
        while (cursor <= end) {
            days.push({ date: new Date(cursor), flights: counts.get(dateKey(cursor)) ?? 0 });
            cursor.setDate(cursor.getDate() + 1);
        }
        return days;
    });

    /** Running airtime total per month, for the cumulative chart. */
    public cumulative = computed<CumulativePoint[]>(() => {
        // Read as a signal so the axis labels re-render on a language switch.
        const lang = this.languageService.lang();
        // Scoped to the period, because the card's total is: the head shows the
        // season's airtime, so a line running to the all-time total - under
        // axis ends naming seasons that total never covered - contradicted it.
        const period = this.period();
        const rows = [...this.state().monthly]
            .filter(row => period === ALL_TIME || row.year === period)
            .sort((a, b) => (a.year + a.month).localeCompare(b.year + b.month));

        let running = 0;
        return rows.map(row => {
            running += Number(row.time ?? 0);
            // month arrives zero-padded as a string.
            const date = new Date(Number(row.year), Number(row.month) - 1, 1);
            return {
                label: date.toLocaleDateString(lang, { month: 'short', year: 'numeric' }),
                seconds: running
            };
        });
    });

    public bests = computed<PersonalBests>(() => {
        const row = this.selectedStatRow();

        const km = Number(row?.bestDistance ?? 0);
        const airtimeSeconds = Number(row?.longestAirtime ?? 0);

        return {
            longestDistance: km > 0 && row?.bestDistanceDate ? { km, date: row.bestDistanceDate } : null,
            longestAirtime: airtimeSeconds > 0 && row?.longestAirtimeDate ? { seconds: airtimeSeconds, date: row.longestAirtimeDate } : null,
            startPlaces: Number(row?.nbStartplaces ?? 0),
            landingPlaces: Number(row?.nbLandingplaces ?? 0)
        };
    });

    /** Fetches one year's day counts once, and only once, per session. */
    private ensureDaily(year: string): void {
        if (this.state().daily.has(year) || this.pendingDaily.has(year)) {
            return;
        }
        this.pendingDaily.add(year);
        this.flightStore.getStatistics('daily', true, { from: `${year}-01-01`, to: `${year}-12-31` }).pipe(
            catchError(() => of([] as FlightStatistic[]))
        ).subscribe(rows => {
            this.pendingDaily.delete(year);
            const days: HeatmapDay[] = rows.map(row => ({
                date: new Date(Number(row.year), Number(row.month) - 1, Number(row.day)),
                flights: Number(row.nbFlights ?? 0)
            }));
            this.state.update(state => {
                const daily = new Map(state.daily);
                daily.set(year, days);
                return { ...state, daily };
            });
        });
    }

    /**
     * One load per session. Everything else is derived, so switching period
     * costs no requests.
     *
     * The shared flight filter applies here: this page has its own control for
     * it now, and a chip bar that says what is narrowing the numbers.
     */
    load(): Observable<StatisticState> {
        const previous = this.state();
        /*
         * Read now, not in the map() below. Stamped on arrival, a filter applied
         * while these three requests were in flight was recorded as already
         * included: `loaded` stayed true and the page kept the unfiltered
         * figures under the new filter's chips for the rest of the session.
         */
        const revision = this.flightStore.revision();
        const global$: Observable<FlightStatistic[] | null> = this.flightStore.getStatistics('global').pipe(catchError(() => of(null)));
        const yearly$ = this.flightStore.getStatistics('yearly').pipe(catchError(() => of([] as FlightStatistic[])));
        const monthly$ = this.flightStore.getStatistics('monthly').pipe(catchError(() => of([] as FlightStatistic[])));

        return forkJoin([global$, yearly$, monthly$]).pipe(
            map(([global, yearly, monthly]): StatisticState => ({
                global: global?.[0] ?? null,
                yearly: yearly ?? [],
                monthly: monthly ?? [],
                // Cleared, not carried over: a filter change can change every
                // day's count, and ensureDaily() re-fetches on demand.
                daily: new Map(),
                // A load where even the global aggregate failed is not loaded:
                // caching it would pin the empty state for the whole session,
                // because the page only refetches while `loaded` is false.
                loaded: global !== null,
                revision
            })),
            tap(next => this.commit(next, previous))
        );
    }

    /**
     * The one place a fetched snapshot lands, so both entry points get the same
     * two guarantees.
     *
     * A load that reached nothing keeps the figures already on screen: committed
     * as-is, the empty snapshot replaced them and the page - which only reloads
     * while `loaded` is false and the user never leaves it - showed skeletons for
     * the rest of the visit. The kept snapshot is re-stamped with the current
     * revision, or `loaded` would still evaluate false and the figures it just
     * put back would not be shown either.
     *
     * And a filter can narrow the logbook to years the selected season is not
     * among. Left pointing at it, the headline reads 0/0/0 with no chip
     * highlighted and no way back.
     */
    private commit(next: StatisticState, previous: StatisticState): void {
        // A failed load keeps the figures on screen rather than blanking them, and
        // leaves `loaded` false so the next visit retries - the shape HomeStore
        // uses. The revision must NOT be re-stamped to the current one: `loaded`
        // compares it against the store's, so stale figures carrying a current
        // revision read as fresh, gate out every later retry, and stay on screen
        // for the rest of the session.
        this.state.set(next.loaded || !previous.loaded
            ? next
            : { ...this.state(), loaded: false });

        const period = this.period();
        if (period !== ALL_TIME && !this.years().includes(period)) {
            this.period.set(ALL_TIME);
        }
    }

    /**
     * Same request set, but past the once-per-session guard the page applies -
     * a filter change has to refetch even though the page never left.
     */
    reload(): Observable<StatisticState> {
        // Nothing to reset first: reload only follows a filter change, which
        // bumps the revision the snapshot is compared against, so `loaded` is
        // already false. Both guards live in commit(), which load() runs either
        // way - the cold path needs them too, because entering the tab after the
        // filter moved on the Flights tab takes load(), not this.
        return this.load();
    }

    clear(): void {
        this.period.set(ALL_TIME);
        this.state.set({ global: null, yearly: [], monthly: [], daily: new Map(), loaded: false, revision: -1 });
        this.pendingDaily.clear();
    }
}
