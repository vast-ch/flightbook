import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { FlightStore } from '../../shared/flight.store';
import { FlightStatistic } from '../../shared/flightStatistic.model';
import { Flight } from '../../shared/flight.model';

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
}

/** 'HH:mm:ss' from the API to seconds. */
function timeToSeconds(time?: string): number {
    if (!time) {
        return 0;
    }
    const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
    return h * 3600 + m * 60 + s;
}

@Injectable({
    providedIn: 'root'
})
export class StatisticStore {
    private flightStore = inject(FlightStore);

    private state = signal<StatisticState>({
        global: null,
        yearly: [],
        monthly: [],
        flights: [],
        loaded: false
    });

    /** Selected period: ALL_TIME or a year. */
    public period = signal<StatisticPeriod>(ALL_TIME);

    public loaded = computed(() => this.state().loaded);
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
     * One entry per day: the last 365 days for all-time, the calendar year for
     * a selected year.
     *
     * All-time is windowed rather than run from the first flight because a
     * pilot flying since 2013 produces ~650 columns - the grid then scrolls
     * far off-screen and the recent weeks, the only ones anyone reads, are
     * indistinguishable from the rest.
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

        let start: Date;
        if (period === ALL_TIME) {
            // 365 days inclusive of today, but never before the first flight -
            // a three-month-old logbook should not open on a year of blanks.
            const window = new Date(today);
            window.setDate(window.getDate() - 364);
            const first = new Date(sorted[0]);
            start = first > window ? first : window;
        } else {
            start = new Date(`${period}-01-01`);
        }

        const end = period === ALL_TIME || Number(period) === today.getFullYear()
            ? today
            : new Date(`${period}-12-31`);

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

    public flyingDays = computed(() => this.heatmap().filter(d => d.flights > 0).length);
    public weekCount = computed(() => Math.ceil(this.heatmap().length / 7));

    /** Running airtime total per month, for the cumulative chart. */
    public cumulative = computed<CumulativePoint[]>(() => {
        const period = this.period();
        const rows = this.state().monthly
            .filter(row => period === ALL_TIME || row.year === period)
            .sort((a, b) => (a.year + a.month).localeCompare(b.year + b.month));

        let running = 0;
        return rows.map(row => {
            running += Number(row.time ?? 0);
            // month arrives zero-padded as a string.
            const date = new Date(Number(row.year), Number(row.month) - 1, 1);
            return {
                label: date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
                seconds: running
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
     * applyFilter is false throughout: the flight-list filter is global state,
     * and this page has no filter control to explain a skewed number.
     */
    load(): Observable<StatisticState> {
        const global$ = this.flightStore.getStatistics('global', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const yearly$ = this.flightStore.getStatistics('yearly', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const monthly$ = this.flightStore.getStatistics('monthly', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const flights$ = this.flightStore.getFlights({ store: false, applyFilter: false }).pipe(catchError(() => of([] as Flight[])));

        return forkJoin([global$, yearly$, monthly$, flights$]).pipe(
            map(([global, yearly, monthly, flights]): StatisticState => ({
                global: global?.[0] ?? null,
                yearly: yearly ?? [],
                monthly: monthly ?? [],
                flights: flights ?? [],
                loaded: true
            })),
            tap(state => this.state.set(state))
        );
    }

    clear(): void {
        this.period.set(ALL_TIME);
        this.state.set({ global: null, yearly: [], monthly: [], flights: [], loaded: false });
    }
}
