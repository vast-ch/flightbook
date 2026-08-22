import { Component, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import moment from 'moment-timezone';
import { ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ModalController, NavController, IonIcon, IonContent, IonList, IonItem, IonToggle, IonLabel, IonInfiniteScroll, IonInfiniteScrollContent, IonPopover } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/account/shared/account.service';
import { User } from 'src/app/account/shared/user.model';
import { Appointment } from '../shared/appointment.model';
import { AppointmentScope, SchoolService } from '../shared/school.service';
import { Subscription } from '../shared/subscription.model';
import { AppointmentDetailsComponent } from '../shared/components/appointment-details/appointment-details.component';
import { AppointmentFilterComponent } from '../shared/components/appointment-filter/appointment-filter.component';
import { AppointmentFilterChipsComponent } from '../shared/components/appointment-filter/appointment-filter-chips.component';
import { State } from '../shared/state';
import { freeSpots, isFull, spotCells } from '../shared/spots';
import { DatePipe } from '@angular/common';
import { addIcons } from "ionicons";
import { filterOutline, ellipsisVerticalOutline, chevronBack, timeOutline, checkmark, close } from "ionicons/icons";
import { FormsModule } from '@angular/forms';
import { School } from '../shared/school.model';
import { LanguageService } from 'src/app/shared/services/language.service';
import { HomeStore } from 'src/app/home/shared/home.store';
import { Location } from '@angular/common';
import { navigateBackOrTo } from 'src/app/shared/util/back-navigation';

/** How close a registration deadline has to be to earn the notice at the top. */
const CLOSING_SOON_HOURS = 24;

/** Backstop on the eager upcoming fetch - 20 a page, so 200 dates. */
const MAX_UPCOMING_PAGES = 10;

@Component({
    selector: 'app-appointment-list',
    templateUrl: './appointment-list.page.html',
    styleUrls: ['./appointment-list.page.scss'],
    imports: [
        DatePipe,
        TranslateModule,
        IonIcon,
        IonContent,
        IonList,
        IonItem,
        IonToggle,
        IonLabel,
        IonInfiniteScroll,
        IonInfiniteScrollContent,
        IonPopover,
        FormsModule,
        AppointmentFilterChipsComponent
    ]
})
export class AppointmentListPage implements OnInit, OnDestroy {
    @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;
    @ViewChild(IonPopover) popover: IonPopover;
    unsubscribe$ = new Subject<void>();
    appointments = signal<Appointment[]>([]);
    currentUser = signal<User | null>(null);
    currentSchool = signal<School | null>(null);
    /** The service's own signal, as Flights and Gliders read theirs. */
    filtered = this.schoolService.filtered;
    private readonly schoolId: number;
    private appointmentId: number;

    /** Exposed so the template can name the canceled state without a string. */
    public readonly State = State;

    public scope = signal<AppointmentScope>('upcoming');

    /** True once a page came back short, which is the only way we know the total. */
    private listComplete = signal<boolean>(false);

    /** Rows the server has handed over, which is what its offset counts. */
    private fetchedCount = 0;

    public loadedCount = computed(() =>
        this.listComplete() && this.scope() === 'upcoming' ? this.appointments().length : 0
    );

    /**
     * Appointments grouped by month. A single pass keeps whatever order the
     * endpoint returned, so infinite-scroll appends land in the right group
     * without re-sorting a paged list.
     */
    public groupedAppointments = computed(() => {
        const groups: { key: string; scheduling: Date; appointments: Appointment[] }[] = [];
        for (const appointment of this.appointments()) {
            const scheduling = new Date(appointment.scheduling);
            const key = `${scheduling.getFullYear()}-${scheduling.getMonth()}`;
            const last = groups[groups.length - 1];
            if (last && last.key === key) {
                last.appointments.push(appointment);
            } else {
                groups.push({ key, scheduling, appointments: [appointment] });
            }
        }
        return groups;
    });

    /** The soonest deadline falling inside the next day, whatever its position. */
    public closingSoon = computed<Appointment | null>(() => {
        if (this.scope() !== 'upcoming') {
            return null;
        }
        const now = Date.now();
        const limit = now + CLOSING_SOON_HOURS * 60 * 60 * 1000;
        // deadlineAt, not `deadline`: enrichAppointment rewrites that field into
        // the school's wall clock parked in a device-local Date, so comparing it
        // against the device clock slid the window by the offset between the two
        // - a pilot abroad was warned about the wrong appointments.
        return this.appointments()
            .filter(appointment => appointment.state !== State.CANCELED && appointment.deadlineAt)
            .filter(appointment => appointment.deadlineAt > now && appointment.deadlineAt <= limit)
            .sort((a, b) => a.deadlineAt - b.deadlineAt)[0] ?? null;
    });

    constructor(
        private activeRoute: ActivatedRoute,
        public navCtrl: NavController,
        private location: Location,
        private schoolService: SchoolService,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private accountService: AccountService,
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private languageService: LanguageService,
        private homeStore: HomeStore
    ) {
        this.schoolId = +this.activeRoute.snapshot.paramMap.get('id');
        this.appointmentId = +this.activeRoute.snapshot.queryParamMap.get('appointmentId');
        addIcons({
            filterOutline,
            ellipsisVerticalOutline,
            'chevron-back': chevronBack,
            'time-outline': timeOutline,
            checkmark,
            close,
            place: 'assets/custom-ion-icons/place.svg'
        });
    }

    ngOnInit() {}

    ionViewDidEnter() {
        if (this.appointments().length === 0) {
            this.initialDataLoad();
        }
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    // ---- View state -----------------------------------------------------

    close() {
        navigateBackOrTo(this.navCtrl, this.location, 'more');
    }

    /** LanguageService, not translate.currentLang: reactive, and always a locale Angular has data for. */
    get currentLang(): string {
        return this.languageService.lang();
    }

    /** The school's own timezone if it has one, matching how dates were stored. */
    get timezone(): string {
        return this.currentSchool()?.timezone || 'UTC';
    }

    setScope(scope: AppointmentScope) {
        if (this.scope() === scope) {
            return;
        }
        this.scope.set(scope);
        this.appointments.set([]);
        this.listComplete.set(false);
        this.fetchedCount = 0;
        this.initialDataLoad();
    }




    // ---- Data -----------------------------------------------------------

    private async initialDataLoad() {
    const loading = await this.loadingCtrl.create({
        message: this.translate.instant('loading.loading')
    });
    await loading.present();

    try {
        // In parallel: none of the three depends on another, and the
        // appointment fetch only needs schoolId, which the route already gave
        // us. Run in series this was three round-trips of spinner.
        const [schools, user, rawAppointments] = await Promise.all([
            this.schoolService.getSchools(),
            firstValueFrom(this.accountService.currentUser()),
            this.scope() === 'upcoming'
                ? this.loadAllUpcoming()
                : firstValueFrom(
                    this.schoolService.getAppointments({ limit: this.schoolService.defaultLimit }, this.schoolId, 'past')
                )
        ]);

        this.currentSchool.set(schools.find((s: School) => s.id === this.schoolId));
        this.currentUser.set(user);

        this.fetchedCount = rawAppointments.length;
        this.listComplete.set(this.scope() === 'upcoming' || rawAppointments.length < this.schoolService.defaultLimit);

        // Enrich appointments with computed state
        const enrichedAppointments = rawAppointments.map(appointment =>
            this.enrichAppointment(appointment)
        );

        const inScope = enrichedAppointments.filter(appointment => this.inScope(appointment));
        // The endpoint sorts scheduling DESC, which reads correctly for Past but
        // backwards for Upcoming - where the design lists the nearest date first.
        if (this.scope() === 'upcoming') {
            inScope.sort((a, b) => new Date(a.scheduling).getTime() - new Date(b.scheduling).getTime());
        }
        this.appointments.set(inScope);

        // Upcoming is fully loaded above; only Past pages.
        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = this.scope() === 'upcoming';
        }

        const appointmentToOpen = this.appointments().find((appointment: Appointment) => appointment.id == this.appointmentId);
        if (appointmentToOpen) {
            this.appointmentId = undefined;
            this.itemTapped(appointmentToOpen);
        }
    } catch (error) {
        console.error('Error loading appointments', error);
        // Optionally, you could show an error alert here
    } finally {
        await loading.dismiss();
    }
}

    /**
     * Upcoming is pulled in full rather than paged. The endpoint sorts
     * scheduling DESC and pages with take/skip, so page one would hold the
     * furthest-future dates and tomorrow's course would be on the last page.
     * Ordering cannot be asked for, so every page is fetched and then sorted -
     * bounded by from=today, which is a school's published dates, not history.
     */
    private async loadAllUpcoming(): Promise<Appointment[]> {
        const all: Appointment[] = [];
        for (let page = 0; page < MAX_UPCOMING_PAGES; page++) {
            const batch = await firstValueFrom(this.schoolService.getAppointments({
                limit: this.schoolService.defaultLimit,
                offset: all.length
            }, this.schoolId, 'upcoming'));
            all.push(...batch);
            if (batch.length < this.schoolService.defaultLimit) {
                return all;
            }
        }
        // Hit the cap: say so rather than quietly showing a partial list.
        console.warn(`More than ${all.length} upcoming appointments; the list is truncated.`);
        return all;
    }

    /**
     * from/to are date-only, so today's appointments come back for either tab.
     * Settle them against the clock here - which is why a page of 20 can render
     * as fewer.
     */
    private inScope(appointment: Appointment): boolean {
        const scheduling = appointment.scheduledAt ?? moment.utc(appointment.scheduling).valueOf();
        return this.scope() === 'upcoming' ? scheduling >= Date.now() : scheduling < Date.now();
    }

    async itemTapped(appointment: Appointment) {
        /*
         * A shared flag rather than the dismiss payload alone: `dismiss({...})`
         * only carries data when the sheet's own chevron closed it, so a
         * backdrop tap or the Android back button after a registration left this
         * list showing the old toggle state and spot count. The sheet writes
         * through to this object as it goes, whatever closes it.
         */
        const outcome = { changed: false };
        const modal = await this.modalCtrl.create({
            component: AppointmentDetailsComponent,
            componentProps: {
                appointment,
                currentUser: this.currentUser(),
                school: this.currentSchool(),
                outcome
            }
        });
        modal.present();
        const resp = await modal.onWillDismiss();
        if (resp.data?.hasChange || outcome.changed) {
            this.initialDataLoad();
        }
    }

    async subscriptionChange(event: CustomEvent, appointment: Appointment) {
        if (this.isDeadlinePassed(appointment)){
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('message.deadlinePassed'),
                buttons: [this.translate.instant('buttons.done')]
            });

            this.initialDataLoad();
            alert.present();
            return;
        }
        if (event.detail.checked) {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('message.subscription'),
                backdropDismiss: false,
                buttons: [
                    {
                        text: this.translate.instant('buttons.yes'),
                        handler: async () => {
                            const currentAppointment = await firstValueFrom(this.schoolService.subscribeToAppointment(this.schoolId, appointment.id));
                            await this.initialDataLoad();

                            const subscription = currentAppointment.subscriptions.find((subscription: Subscription) => subscription.user.email === this.currentUser()?.email);
                            if (subscription.waitingList) {
                                this.informWaitingList();
                            }
                        }
                    },
                    {
                        text: this.translate.instant('buttons.no'),
                        handler: () => {
                            this.initialDataLoad();
                        }
                    }
                ]
            });

            await alert.present();
        } else {
            let message: string;
            if (appointment.maxPeople && appointment.countWaitingList >= 0) {
                message = this.translate.instant('message.removeSubscriptionWaitingList');
            } else {
                message = this.translate.instant('message.removeSubscription');
            }

            const alert = await this.alertController.create({
                header: this.translate.instant('message.warning'),
                message: message,
                backdropDismiss: false,
                buttons: [
                    {
                        text: this.translate.instant('buttons.yes'),
                        handler: async () => {
                            await firstValueFrom(this.schoolService.deleteAppointmentSubscription(this.schoolId, appointment.id));
                            await this.initialDataLoad();
                        }
                    },
                    {
                        text: this.translate.instant('buttons.no'),
                        handler: () => {
                            this.initialDataLoad();
                        }
                    }
                ]
            });

            await alert.present();
        }
    }

    private async informWaitingList() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.infotitle'),
            message: this.translate.instant('message.watingList'),
            buttons: [this.translate.instant('buttons.done')]
        });

        alert.present();
    }

    loadData(event: any) {
        // Only Past pages; Upcoming was loaded in full, so appending a DESC page
        // to an ascending list would interleave dates.
        if (this.scope() === 'upcoming') {
            event.target.complete();
            event.target.disabled = true;
            return;
        }
        this.schoolService.getAppointments({
            limit: this.schoolService.defaultLimit,
            // fetchedCount, not the rendered length: inScope() drops today's
            // wrong-side appointments, and paging on the shorter list would ask
            // the server for rows it has already sent - the same appointment
            // twice, and a duplicate track key with it.
            offset: this.fetchedCount
        }, this.schoolId, this.scope())
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((res: Appointment[]) => {
                event.target.complete();
                this.fetchedCount += res.length;
                if (res.length < this.schoolService.defaultLimit) {
                    event.target.disabled = true;
                    this.listComplete.set(true);
                }

                const enrichedNew = res
                    .map(appointment => this.enrichAppointment(appointment))
                    .filter(appointment => this.inScope(appointment));
                this.appointments.update(current => [...current, ...enrichedNew]);
            });
    }

    // Helper method to enrich appointment with computed properties
    private enrichAppointment(appointment: Appointment): Appointment {
        const user = this.currentUser();
        // Captured before the rewrite below: everything that compares this
        // appointment against "now" has to use the real instant, not the
        // school's wall clock parked in a device-local Date.
        appointment.scheduledAt = moment.utc(appointment.scheduling).valueOf();
        appointment.deadlineAt = appointment.deadline ? moment.utc(appointment.deadline).valueOf() : undefined;
        appointment.subscribed = appointment.subscriptions?.some((subscription: Subscription) =>
            subscription.user.email === user?.email
        ) ?? false;

        if (this.currentSchool()?.timezone) {
            appointment.scheduling = new Date(moment.utc(appointment.scheduling).tz(this.currentSchool()?.timezone).format('YYYY-MM-DD HH:mm:ss'));
            // Guarded: an appointment with no deadline used to come out of here
            // holding an Invalid Date, which the detail view would try to render.
            if (appointment.deadline) {
                appointment.deadline = new Date(moment.utc(appointment.deadline).tz(this.currentSchool()?.timezone).format('YYYY-MM-DD HH:mm:ss'));
            }
        }

        appointment.toggleDisabled = this.computeToggleDisabled(appointment);
        appointment.lineDisabled = this.computeLineDisabled(appointment, appointment.subscribed);

        // Stamped here rather than called from the template: the row binds up
        // to 20 cells per appointment, and a method call would rebuild every
        // array on every change-detection pass - which Ionic runs on each
        // scroll frame - forcing @for to re-diff the whole list each time.
        appointment.spotCells = spotCells(appointment.countSubscription, appointment.maxPeople);
        appointment.freeSpots = freeSpots(appointment.countSubscription, appointment.maxPeople);
        appointment.isFull = isFull(appointment.countSubscription, appointment.maxPeople);

        return appointment;
    }

    private computeToggleDisabled(appointment: Appointment): boolean {
        if (appointment.scheduledAt < Date.now() || appointment.state == State.CANCELED) {
            return true;
        }
        return this.isDeadlinePassed(appointment);
    }

    private computeLineDisabled(appointment: Appointment, subscribed: boolean): boolean {
        if (appointment.scheduledAt < Date.now() || appointment.state == State.CANCELED) {
            return true;
        }

        if (!subscribed && this.isDeadlinePassed(appointment)) {
            return true;
        }
        return false;
    }

    private isDeadlinePassed(appointment: Appointment): boolean {
        if (!appointment.deadline) {
            return false;
        }

        // @TODO -> Remove after migrate scheduling and deadline date to the correct utc time
        if (!this.currentSchool().timezone) {
            const deadlineWithoutTimezone = moment.utc(appointment.deadline).tz('Europe/Zurich', true);
            const nowWithoutTimezone = moment.tz('Europe/Zurich');
            return deadlineWithoutTimezone.isBefore(nowWithoutTimezone);
        }

        // deadlineAt, not `deadline`: enrichAppointment rewrites that field into
        // the school's wall clock before this runs, and .tz() only changes how an
        // instant prints - it cannot undo the shift. Same fix as the detail view.
        const closesAt = appointment.deadlineAt ?? moment.utc(appointment.deadline).valueOf();
        // An unparseable deadline leaves NaN, which is neither past nor future.
        return Number.isFinite(closesAt) && closesAt < Date.now();
    }

    /**
     * A chip cleared from the summary row. The same refetch the sheet triggers on
     * apply - the rows on screen were fetched at the old filter's offsets.
     */
    reloadForFilter() {
        this.initialDataLoad();
    }

    async openFilter() {
        const modal = await this.modalCtrl.create({
            component: AppointmentFilterComponent,
            cssClass: 'fb-filter-sheet'
        });

        /*
         * Compared before and after rather than read off the dismiss role: the
         * sheet edits the shared filter as it goes, and a backdrop tap or the
         * Android back button dismisses it without any role of ours - which
         * left the filter armed while the list, and its "filtered" chip, still
         * showed everything. The flight filter watches its store's revision
         * for the same reason.
         */
        const before = this.filterSnapshot();
        modal.present();
        await modal.onWillDismiss();
        if (this.filterSnapshot() !== before) {
            this.initialDataLoad();
        }
    }

    /** The filter as a value, so an untouched sheet costs the list no fetch. */
    private filterSnapshot(): string {
        const { from, to, state } = this.schoolService.filter();
        return JSON.stringify([from ?? null, to ?? null, state ?? '']);
    }

    async leaveSchool() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.warning'),
            message: this.translate.instant('school.leaveSchoolConfirm', { schoolName: this.currentSchool()?.name || '' }),
            buttons: [
                {
                    text: this.translate.instant('buttons.no'),
                    role: 'cancel',
                    handler: () => {
                        this.popover?.dismiss();
                    }
                },
                {
                    text: this.translate.instant('buttons.yes'),
                    handler: async () => {
                        try {
                            await firstValueFrom(this.schoolService.leaveSchool(this.schoolId));
                            this.schoolService.removeSchoolFromStore(this.schoolId);
                            // Home caches the next appointment and the school
                            // name, and its own guard only watches the logbook,
                            // so it has to be told the enrolment changed.
                            this.homeStore.invalidate();
                            this.popover?.dismiss();
                            // 'home' now, not '/news' - that route only still
                            // works because it redirects here.
                            this.navCtrl.navigateBack('home');
                        } catch (error) {
                            console.error('Error leaving school:', error);
                        }
                    }
                }
            ]
        });
        await alert.present();
    }

}
