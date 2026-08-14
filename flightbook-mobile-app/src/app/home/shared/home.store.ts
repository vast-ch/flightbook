import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, from, of, Observable } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import moment from 'moment-timezone';
import { FlightStore } from '../../flight/shared/flight.store';
import { SchoolService } from '../../school/shared/school.service';
import { FlightStatistic } from '../../flight/shared/flightStatistic.model';
import { Appointment } from '../../school/shared/appointment.model';
import { School } from '../../school/shared/school.model';
import { ControlSheet } from '../../shared/domain/control-sheet';

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
        loaded: false
    });

    public globalStats = computed(() => this.state().globalStats);
    public monthlyStats = computed(() => this.state().monthlyStats);
    public nextAppointment = computed(() => this.state().nextAppointment);
    public loaded = computed(() => this.state().loaded);

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
        // applyFilter: false - the dashboard always shows all-time totals,
        // never whatever the user last filtered the flight list by.
        const global$: Observable<FlightStatistic[]> =
            this.flightStore.getStatistics('global', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const monthly$: Observable<FlightStatistic[]> =
            this.flightStore.getStatistics('monthly', false).pipe(catchError(() => of([] as FlightStatistic[])));
        const controlSheet$: Observable<ControlSheet | null> =
            this.schoolService.getControlSheet().pipe(catchError(() => of(null)));
        const nextAppointment$: Observable<UpcomingAppointment | null> =
            this.loadNextAppointment().pipe(catchError(() => of(null)));
        const schools$: Observable<School[]> =
            from(this.schoolService.getSchools()).pipe(catchError(() => of([] as School[])));

        return forkJoin([global$, monthly$, controlSheet$, nextAppointment$, schools$]).pipe(
            map(([global, monthly, controlSheet, nextAppointment, schools]): HomeState => ({
                globalStats: global?.[0] ?? null,
                monthlyStats: monthly ?? [],
                nextAppointment,
                controlSheet,
                schools: schools ?? [],
                loaded: true
            })),
            tap(state => this.state.set(state))
        );
    }

    /**
     * Appointments are per school and come back scheduling-DESC, so they get
     * flattened and re-sorted ascending here. The shared schoolService.filter is
     * deliberately left untouched - mutating it would corrupt the appointment
     * list page's own filter state.
     */
    private loadNextAppointment(): Observable<UpcomingAppointment | null> {
        return from(this.schoolService.getSchools()).pipe(
            switchMap((schools: School[]) => {
                if (!schools || schools.length === 0) {
                    return of(null);
                }

                return forkJoin(
                    schools.map(school =>
                        this.schoolService.getAppointments({}, school.id).pipe(
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
            .filter(entry => entry.appointment?.scheduling && moment.utc(entry.appointment.scheduling).isSameOrAfter(now))
            .sort((a, b) => moment.utc(a.appointment.scheduling).valueOf() - moment.utc(b.appointment.scheduling).valueOf());

        if (upcoming.length === 0) {
            return null;
        }

        const next = upcoming[0];
        const zone = next.school?.timezone || FALLBACK_TIMEZONE;
        const scheduled = moment.utc(next.appointment.scheduling).tz(zone);

        return {
            appointment: next.appointment,
            school: next.school,
            daysUntil: scheduled.startOf('day').diff(moment().tz(zone).startOf('day'), 'days')
        };
    }

    clear(): void {
        this.state.set({
            globalStats: null,
            monthlyStats: [],
            nextAppointment: null,
            controlSheet: null,
            schools: [],
            loaded: false
        });
    }
}
