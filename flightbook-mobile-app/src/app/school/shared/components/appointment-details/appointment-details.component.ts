import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController, IonIcon, IonContent, IonButton } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { User } from 'src/app/account/shared/user.model';
import { Appointment } from 'src/app/school/shared/appointment.model';
import { Subscription } from 'src/app/school/shared/subscription.model';
import { SchoolService } from '../../school.service';
import { State } from '../../state';
import { SpotCell, spotCells } from '../../spots';
import { DatePipe } from '@angular/common';
import { addIcons } from "ionicons";
import { chevronBack, peopleOutline, timeOutline } from "ionicons/icons";
import moment from 'moment-timezone';
import { School } from '../../school.model';
import { LanguageService } from 'src/app/shared/services/language.service';

/** Above this the relative deadline reads in days rather than hours. */
const HOURS_BEFORE_DAYS = 48;

@Component({
    selector: 'fb-appointment-details',
    templateUrl: './appointment-details.component.html',
    styleUrls: ['./appointment-details.component.scss'],
    imports: [
        DatePipe,
        TranslateModule,
        IonIcon,
        IonContent,
        IonButton
    ]
})
export class AppointmentDetailsComponent implements OnInit {

    appointment: Appointment;
    currentUser: User;
    school: School;
    isSubscribed = false;
    subscribed: Subscription[] = [];
    waitingList: Subscription[] = [];
    hasChanges = false;

    /** LanguageService, not translate.currentLang: reactive, and always a locale Angular has data for. */
    get currentLang(): string {
        return this.languageService.lang();
    }

    constructor(
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private schoolService: SchoolService,
        private languageService: LanguageService
    ) {
        addIcons({
            'chevron-back': chevronBack,
            'time-outline': timeOutline,
            peopleOutline,
            place: 'assets/custom-ion-icons/place.svg'
        });
    }

    ngOnInit() {
        this.subscribed = [];
        this.waitingList = [];
        this.isUserSubscribed();
        if (this.appointment.maxPeople) {
            this.appointment.subscriptions.forEach((subscription: Subscription) => {
                if (subscription.waitingList) {
                    this.waitingList.push(subscription);
                } else {
                    this.subscribed.push(subscription);
                }
            })
        } else {
            this.subscribed = this.appointment.subscriptions;
        }
    }

    // ---- View helpers ---------------------------------------------------

    /** The school's own timezone if it has one, matching how dates were stored. */
    get timezone(): string {
        return this.school?.timezone || 'UTC';
    }

    spotCells(): SpotCell[] {
        return spotCells(this.appointment.countSubscription ?? this.subscribed.length, this.appointment.maxPeople);
    }

    initials(subscription: Subscription): string {
        const user = subscription.user;
        return `${user?.firstname?.charAt(0) ?? ''}${user?.lastname?.charAt(0) ?? ''}`.toUpperCase();
    }

    isSelf(subscription: Subscription): boolean {
        return subscription.user?.email === this.currentUser?.email;
    }

    /**
     * A school that sets no deadline can still leave an unparseable value behind
     * on the way through the timezone conversion, and the date pipe would render
     * that. Check the date is real, not just present.
     */
    hasDeadline(): boolean {
        const deadline = this.appointment.deadline;
        return !!deadline && !isNaN(new Date(deadline).getTime());
    }

    /** How long is left to register - null once the deadline has gone. */
    deadlineRelative(): string | null {
        if (!this.hasDeadline()) {
            return null;
        }
        // deadlineAt, not `deadline`: that field has been rewritten into the
        // school's wall clock held in a device-local Date, so measuring it
        // against the device clock is out by the offset between the two - a
        // pilot abroad was offered "in 3 h" on a registration already closed.
        // Minutes, not diff('hours'), which truncates toward zero: anything
        // inside the hour either side came back as 0 and read "in 0 h".
        const closesAt = this.appointment.deadlineAt ?? moment.utc(this.appointment.deadline).valueOf();
        const minutes = Math.round((closesAt - Date.now()) / 60000);
        if (minutes <= 0) {
            return null;
        }
        const hours = Math.ceil(minutes / 60);
        return hours <= HOURS_BEFORE_DAYS
            ? this.translate.instant('appointment.inHours', { hours })
            : this.translate.instant('appointment.inDays', { days: Math.round(hours / 24) });
    }

    /** Past or canceled, as opposed to merely closed for registration. */
    isPast(): boolean {
        // scheduledAt for the same reason as deadlineAt above.
        const startsAt = this.appointment.scheduledAt ?? moment.utc(this.appointment.scheduling).valueOf();
        return startsAt < Date.now() || this.appointment.state === State.CANCELED;
    }

    // ---- Registration ---------------------------------------------------

    async subscribe() {
        if (this.isDisabled()) {
            return;
        }
        if (!this.isSubscribed) {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('message.subscription'),
                backdropDismiss: false,
                buttons: [
                    {
                        text: this.translate.instant('buttons.yes'),
                        handler: async () => {
                            await firstValueFrom(this.schoolService.subscribeToAppointment(this.school.id, this.appointment.id));
                            this.appointment = this.normalizeSchedule(await firstValueFrom(this.schoolService.getAppointment(this.school.id, this.appointment.id)));
                            this.hasChanges = true;
                            this.ngOnInit();
                            const subscription = this.appointment.subscriptions.find((subscription: Subscription) => subscription.user.email === this.currentUser.email);
                            if (subscription.waitingList) {
                                this.informWaitingList();
                            }
                            this.isSubscribed = true;
                        }
                    },
                    {
                        text: this.translate.instant('buttons.no'),
                        handler: () => {
                            this.isSubscribed = false;
                        }
                    }
                ]
            });

            await alert.present();
        } else {
            let message: string;
            if (this.appointment.maxPeople && this.appointment.countWaitingList >= 0) {
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
                            await firstValueFrom(this.schoolService.deleteAppointmentSubscription(this.school.id, this.appointment.id));
                            this.appointment = this.normalizeSchedule(await firstValueFrom(this.schoolService.getAppointment(this.school.id, this.appointment.id)));
                            this.ngOnInit();
                            this.isSubscribed = false;
                            this.hasChanges = true;
                        }
                    },
                    {
                        text: this.translate.instant('buttons.no'),
                        handler: () => {
                            this.isSubscribed = true;
                        }
                    }
                ]
            });

            await alert.present();
        }
    }

    /**
     * The appointment handed in by the list has already had its stored wall clock
     * shifted into the school's timezone; one refetched here has not. Without the
     * same treatment the date and time visibly jump after registering.
     */
    private normalizeSchedule(appointment: Appointment): Appointment {
        // Captured before any rewrite, exactly as the list does it: everything
        // that compares this appointment against "now" needs the real instant,
        // not the school's wall clock parked in a device-local Date.
        appointment.scheduledAt = moment.utc(appointment.scheduling).valueOf();
        appointment.deadlineAt = appointment.deadline ? moment.utc(appointment.deadline).valueOf() : undefined;

        const timezone = this.school?.timezone;
        if (!timezone) {
            return appointment;
        }
        appointment.scheduling = new Date(moment.utc(appointment.scheduling).tz(timezone).format('YYYY-MM-DD HH:mm:ss'));
        if (appointment.deadline) {
            appointment.deadline = new Date(moment.utc(appointment.deadline).tz(timezone).format('YYYY-MM-DD HH:mm:ss'));
        }
        return appointment;
    }

    private async informWaitingList() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.infotitle'),
            message: this.translate.instant('message.watingList'),
            buttons: [this.translate.instant('buttons.done')]
        });

        alert.present();
    }

    isUserSubscribed() {
        this.isSubscribed = this.appointment.subscriptions?.some((subscription: Subscription) =>
            subscription.user.email === this.currentUser.email
        );
    }

    isDisabled() {
        // scheduledAt, not `scheduling`: normalizeSchedule has parked the school's
        // wall clock in that field, so measuring it against the device clock is
        // out by the offset between the two - which is what left Register enabled
        // beside an appointment the relative label already called past.
        const startsAt = this.appointment.scheduledAt ?? moment.utc(this.appointment.scheduling).valueOf();
        if (startsAt < Date.now() || this.appointment.state == State.CANCELED) {
            return true;
        }
        return this.isDeadlinePassed(this.appointment);
    }

    private isDeadlinePassed(appointment: Appointment): boolean {
        if (!appointment.deadline) {
            return false;
        }

        // @TODO -> Remove after migrate scheduling and deadline date to the correct utc time
        if (!this.school.timezone) {
            const deadlineWithoutTimezone = moment(moment.utc(appointment.deadline).format('YYYY-MM-DD HH:mm:ss'));
            const nowWithoutTimezone = moment(moment(new Date()).format('YYYY-MM-DD HH:mm:ss'));
            return deadlineWithoutTimezone.isBefore(nowWithoutTimezone);
        }

        // deadlineAt for the same reason, and .tz() could never have rescued the
        // old comparison: it changes how an instant prints, not which instant it
        // is, so both sides were rendered in the school's zone while one of them
        // was still the shifted value.
        const closesAt = appointment.deadlineAt ?? moment.utc(appointment.deadline).valueOf();
        return closesAt < Date.now();
    }

    close() {
        return this.modalCtrl.dismiss({ hasChange: this.hasChanges });
    }

}
