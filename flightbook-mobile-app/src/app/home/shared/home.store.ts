import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, from, of, Observable } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import moment from 'moment-timezone';
import { FlightStore } from '../../flight/shared/flight.store';
import { SchoolService } from '../../school/shared/school.service';
import { FlightStatistic } from '../../flight/shared/flightStatistic.model';
import { Appointment } from '../../school/shared/appointment.model';
import { State } from '../../school/shared/state';
import { School } from '../../school/shared/school.model';
import { ControlSheet } from '../../shared/domain/control-sheet';
import { SessionTeardownRegistry } from 'src/app/shared/services/session-teardown.registry';

/**
 * Flights required for the SHV/SHGPA licence. Not exposed by the API, so it
 * lives here as a single named constant.
 */
export const REQUIRED_LICENCE_FLIGHTS = 50;

/** Schools without an explicit timezone predate the field. */
const FALLBACK_TIMEZONE = 'Europe/Zurich';

export interface TrainingProgress {
    ratedSkills: number;
    totalSkills: number;
    schoolName: string | null;
}

export interface UpcomingAppointment {
    appointment: Appointment;
    school: School;
    /** Whole days from today; 0 means today. */
    daysUntil: number;
}

export interface HomeState {
    globalStats: FlightStatistic | null;
    monthlyStats: FlightStatistic[];
    nextAppointment: UpcomingAppointment | null;
    controlSheet: ControlSheet | null;
    schools: School[];
    loaded: boolean;
    /** FlightStore.dataRevision this snapshot was taken at. */
    revision: number;
}

@Injectable({
    providedIn: 'root'
})
export class HomeStore {
    private flightStore = inject(FlightStore);
    private schoolService = inject(SchoolService);

    private state = signal<HomeState>({
        globalStats: null,
        monthlyStats: [],
        nextAppointment: null,
        controlSheet: null,
        schools: [],
        loaded: false,
        revision: -1
    });

    constructor() {
        // Registered rather than reached for by SessionService: importing this
        // store there put moment-timezone in the initial bundle.
        inject(SessionTeardownRegistry).register(() => this.clear());
    }

    public globalStats = computed(() => this.state().globalStats);
    public monthlyStats = computed(() => this.state().monthlyStats);
    public nextAppointment = computed(() => this.state().nextAppointment);

    /**
     * False once the logbook has moved under us. The page loads only while this
     * is false, so without the revision check a flight added from the + tab
     * never showed up on the dashboard for the rest of the session.
     *
     * dataRevision, not revision: every request below passes applyFilter:false,
     * so a filter tap on the Flights tab cannot change these figures - and
     * watching the combined counter refetched all five of them to prove it.
     */
    public loaded = computed(() => this.state().loaded && this.state().revision === this.flightStore.dataRevision());

    public trainingProgress = computed<TrainingProgress | null>(() => {
        const sheet = this.state().controlSheet;
        if (!sheet) {
            return null;
        }

        let rated = 0;
        let total = 0;
        for (const group of [sheet.theory, sheet.trainingHill, sheet.altitudeFlight]) {
            if (!group) {
                continue;
            }
            for (const key of Object.keys(group)) {
                // `id` is a database key, not a skill.
                if (key === 'id') {
                    continue;
                }
                total++;
                if ((group[key] ?? 0) > 0) {
                    rated++;
                }
            }
        }

        return total === 0
            ? null
            // The school comes from the enrolment, not from whether there
            // happens to be an upcoming appointment.
            : { ratedSkills: rated, totalSkills: total, schoolName: this.state().schools?.[0]?.name ?? null };
    });

    /**
     * What Home shows: the same progress, but only while training is still
     * running. A passed practical exam ends it, and a licensed pilot has no use
     * for a training tracker on their dashboard.
     *
     * Deliberately not folded into trainingProgress - the control sheet reads
     * that for its school name and skills count, and it stays the record of the
     * training after the exam is behind you.
     */
    public activeTrainingProgress = computed<TrainingProgress | null>(() =>
        this.state().controlSheet?.passPracticeExam ? null : this.trainingProgress()
    );

    /** Percentage of control-sheet skills rated, for the progress bar. */
    public controlSheetPercent = computed(() => {
        const progress = this.trainingProgress();
        if (!progress || progress.totalSkills === 0) {
            return 0;
        }
        return Math.min(100, Math.round((progress.ratedSkills / progress.totalSkills) * 100));
    });

    /**
     * The SHV/SHGPA solo flight requirement: at least one flight logged as
     * flown alone. nbFlightsAlone is already in the API response.
     */
    public soloFlightDone = computed(() => (this.state().globalStats?.nbFlightsAlone ?? 0) > 0);

    /** Flights logged so far, against the licence requirement. */
    public licenceProgress = computed(() => {
        const flights = this.state().globalStats?.nbFlights ?? 0;
        return {
            flights,
            required: REQUIRED_LICENCE_FLIGHTS,
            percent: Math.min(100, Math.round((flights / REQUIRED_LICENCE_FLIGHTS) * 100))
        };
    });

    load(): Observable<HomeState> {
        const previous = this.state();
        /*
         * Read now, not in the map() below. Stamped on arrival, a flight logged
         * from the + sheet while these five requests were in flight was counted
         * as already included, `loaded` stayed true for the rest of the session
         * and Home kept showing the totals from before the flight.
         */
        const revision = this.flightStore.dataRevision();
        // applyFilter: false - the dashboard always shows all-time totals,
        // never whatever the user last filtered the flight list by.
        const global$: Observable<FlightStatistic[] | null> =
            this.flightStore.getStatistics('global', false).pipe(catchError(() => of(null)));
        const monthly$: Observable<FlightStatistic[]> =
            this.flightStore.getStatistics('monthly', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const controlSheet$: Observable<ControlSheet | null> =
            this.schoolService.getControlSheet().pipe(catchError(() => of(null)));
        // One resolution of the school list, shared by the state field and the
        // appointment fan-out - two calls raced the service's cache and sent
        // two identical requests on every cold load.
        const schools$: Observable<School[]> = from(this.schoolService.getSchools()).pipe(
            catchError(() => of([] as School[])),
            shareReplay({ bufferSize: 1, refCount: false })
        );
        const nextAppointment$: Observable<UpcomingAppointment | null> =
            this.loadNextAppointment(schools$).pipe(catchError(() => of(null)));

        return forkJoin([global$, monthly$, controlSheet$, nextAppointment$, schools$]).pipe(
            map(([global, monthly, controlSheet, nextAppointment, schools]): HomeState => ({
                globalStats: global?.[0] ?? null,
                monthlyStats: monthly ?? [],
                nextAppointment,
                controlSheet,
                schools: schools ?? [],
                // Only a load that actually reached the API counts as loaded.
                // Marking a wholly failed load as done cached an all-zero
                // dashboard for the session - the page's `if (!loaded())` guard
                // would never retry it.
                loaded: global !== null,
                revision
            })),
            // A load that reached nothing keeps the last good snapshot rather
            // than blanking a dashboard that was already filled - the flag is
            // still false, so the next visit to the tab retries either way.
            // `this.state()`, not the `previous` captured above: the control-sheet
            // page pushes a saved sheet in through setControlSheet() while these
            // requests are in flight, and writing the call-time snapshot back
            // rolled that save off the screen it was made on.
            tap(state => this.state.set(state.loaded ? state : { ...this.state(), loaded: false }))
        );
    }

    /**
     * Appointments are per school and come back scheduling-DESC, so they get
     * flattened and re-sorted ascending here. applyFilter: false because the
     * appointment list's filter lives on the shared service and Home has no
     * control to explain - or undo - a card that silently disappeared.
     */
    private loadNextAppointment(schools$: Observable<School[]>): Observable<UpcomingAppointment | null> {
        return schools$.pipe(
            switchMap((schools: School[]) => {
                if (!schools || schools.length === 0) {
                    return of(null);
                }

                return forkJoin(
                    schools.map(school =>
                        this.schoolService.getAppointments({ applyFilter: false }, school.id, 'upcoming').pipe(
                            map((appointments: Appointment[]) => (appointments ?? []).map(appointment => ({ appointment, school }))),
                            catchError(() => of([] as { appointment: Appointment; school: School }[]))
                        )
                    )
                ).pipe(map(perSchool => this.pickNext(perSchool.flat())));
            })
        );
    }

    private pickNext(entries: { appointment: Appointment; school: School }[]): UpcomingAppointment | null {
        const now = moment();
        const upcoming = entries
            // CANCELED excluded: the `upcoming` scope only appends `from=today`,
            // so a cancelled appointment still comes back - and Home has no
            // struck-through state to show it with. Advertising one as the next
            // flight sends the pilot to a meeting point nobody will be at.
            .filter(entry => entry.appointment?.scheduling
                && entry.appointment.state !== State.CANCELED
                && moment.utc(entry.appointment.scheduling).isSameOrAfter(now))
            .sort((a, b) => moment.utc(a.appointment.scheduling).valueOf() - moment.utc(b.appointment.scheduling).valueOf());

        if (upcoming.length === 0) {
            return null;
        }

        const next = upcoming[0];
        const zone = next.school?.timezone || FALLBACK_TIMEZONE;
        const scheduled = moment.utc(next.appointment.scheduling).tz(zone);

        return {
            /*
             * scheduling is rebuilt as the school's wall clock, exactly as the
             * appointment list does it. Angular's DatePipe cannot take an IANA
             * zone - it parses the argument with Date.parse and falls back to the
             * device offset - so without this Home showed a pilot abroad a
             * different time than the appointment screens for the same date.
             */
            appointment: {
                ...next.appointment,
                scheduling: new Date(scheduled.format('YYYY-MM-DD HH:mm:ss'))
            } as Appointment,
            school: next.school,
            // clone(): startOf mutates in place, and `scheduled` is what the
            // displayed start time above is formatted from.
            daysUntil: scheduled.clone().startOf('day').diff(moment().tz(zone).startOf('day'), 'days')
        };
    }

    /**
     * Push a sheet the control-sheet page just saved straight into the state.
     * That page used to call load() after every star tap - five requests,
     * including one unbounded appointment fetch per school - to move a progress
     * bar off a value it already had in hand.
     */
    setControlSheet(controlSheet: ControlSheet | null): void {
        this.state.update(state => ({ ...state, controlSheet }));
    }

    /**
     * Marks the snapshot stale without dropping it, so the next visit to Home
     * refetches. For changes the dashboard reads but FlightStore.revision knows
     * nothing about - leaving a school being the one that showed: the card kept
     * offering an appointment at a school the pilot had just left.
     */
    invalidate(): void {
        this.state.update(state => ({ ...state, loaded: false }));
    }

    clear(): void {
        this.state.set({
            globalStats: null,
            monthlyStats: [],
            nextAppointment: null,
            controlSheet: null,
            schools: [],
            loaded: false,
            revision: -1
        });
    }
}
