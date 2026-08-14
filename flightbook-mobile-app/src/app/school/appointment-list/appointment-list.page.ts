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
import { State } from '../shared/state';
import { SpotCell, freeSpots, isFull, spotCells } from '../shared/spots';
import { DatePipe } from '@angular/common';
import { addIcons } from "ionicons";
import { filterOutline, ellipsisVerticalOutline, chevronBack, timeOutline, checkmark, close } from "ionicons/icons";
import { FormsModule } from '@angular/forms';
import { School } from '../shared/school.model';

/** How close a registration deadline has to be to earn the notice at the top. */
const CLOSING_SOON_HOURS = 24;

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
        FormsModule
    ]
})
export class AppointmentListPage implements OnInit, OnDestroy {
    @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;
    @ViewChild(IonPopover) popover: IonPopover;
    unsubscribe$ = new Subject<void>();
    appointments = signal<Appointment[]>([]);
    currentUser = signal<User | null>(null);
    currentSchool = signal<School | null>(null);
    currentLang: string;
    filtered: boolean;
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
        return this.appointments()
            .filter(appointment => appointment.state !== State.CANCELED && appointment.deadline)
            .filter(appointment => {
                const deadline = new Date(appointment.deadline).getTime();
                return deadline > now && deadline <= limit;
            })
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null;
    });

    constructor(
        private activeRoute: ActivatedRoute,
        public navCtrl: NavController,
        private schoolService: SchoolService,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private accountService: AccountService,
        private modalCtrl: ModalController,
        private alertController: AlertController
    ) {
        this.currentLang = this.translate.currentLang;
        this.filtered = this.schoolService.filtered$.getValue();
        this.schoolService.filtered$.pipe(takeUntil(this.unsubscribe$))
            .subscribe((res: boolean) => {
                this.filtered = res;
            });
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
        this.navCtrl.navigateBack('more');
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

    freeSpots(appointment: Appointment): number {
        return freeSpots(appointment.countSubscription, appointment.maxPeople);
    }

    isFull(appointment: Appointment): boolean {
        return isFull(appointment.countSubscription, appointment.maxPeople);
    }

    spotCells(appointment: Appointment): SpotCell[] {
        return spotCells(appointment.countSubscription, appointment.maxPeople);
    }

    // ---- Data -----------------------------------------------------------

    private async initialDataLoad() {
    const loading = await this.loadingCtrl.create({
        message: this.translate.instant('loading.loading')
    });
    await loading.present();

    try {
        const schools = await this.schoolService.getSchools();
        const school = schools.find((s: School) => s.id === this.schoolId);
        this.currentSchool.set(school);

        const user = await firstValueFrom(this.accountService.currentUser());
        this.currentUser.set(user);

        const rawAppointments = await firstValueFrom(
            this.schoolService.getAppointments({ limit: this.schoolService.defaultLimit }, this.schoolId, this.scope())
        );

        this.fetchedCount = rawAppointments.length;
        this.listComplete.set(rawAppointments.length < this.schoolService.defaultLimit);

        // Enrich appointments with computed state
        const enrichedAppointments = rawAppointments.map(appointment =>
            this.enrichAppointment(appointment)
        );

        this.appointments.set(enrichedAppointments.filter(appointment => this.inScope(appointment)));

        // Reset infinite scroll state
        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = false;
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
     * from/to are date-only, so today's appointments come back for either tab.
     * Settle them against the clock here - which is why a page of 20 can render
     * as fewer.
     */
    private inScope(appointment: Appointment): boolean {
        const scheduling = new Date(appointment.scheduling).getTime();
        return this.scope() === 'upcoming' ? scheduling >= Date.now() : scheduling < Date.now();
    }

    async itemTapped(appointment: Appointment) {
        const modal = await this.modalCtrl.create({
            component: AppointmentDetailsComponent,
            componentProps: {
                appointment,
                currentUser: this.currentUser(),
                school: this.currentSchool()
            }
        });
        modal.present();
        const resp = await modal.onWillDismiss();
        if (resp.data?.hasChange) {
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

        return appointment;
    }

    private computeToggleDisabled(appointment: Appointment): boolean {
        if (new Date(appointment.scheduling).getTime() < new Date().getTime() || appointment.state == State.CANCELED) {
            return true;
        }
        return this.isDeadlinePassed(appointment);
    }

    private computeLineDisabled(appointment: Appointment, subscribed: boolean): boolean {
        if (new Date(appointment.scheduling).getTime() < new Date().getTime() || appointment.state == State.CANCELED) {
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

        const deadline = moment(appointment.deadline).tz(this.currentSchool().timezone);
        const now = moment.tz(this.currentSchool().timezone);
        return deadline.isBefore(now);
    }

    async openFilter() {
        const modal = await this.modalCtrl.create({
            component: AppointmentFilterComponent,
            cssClass: 'appointment-filter-class',
            componentProps: {
                infiniteScroll: this.infiniteScroll
            }
        });

        modal.present();
        const { role } = await modal.onWillDismiss();
        if (role == "filter" || role == "clear") {
            this.initialDataLoad();
        }
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
                            this.popover?.dismiss();
                            this.navCtrl.navigateBack('/news');
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
