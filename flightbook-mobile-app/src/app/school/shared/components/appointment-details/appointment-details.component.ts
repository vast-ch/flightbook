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
    currentLang: string;
    school: School;
    isSubscribed = false;
    subscribed: Subscription[] = [];
    waitingList: Subscription[] = [];
    hasChanges = false;

    constructor(
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private schoolService: SchoolService
    ) {
        this.currentLang = this.translate.currentLang;
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
        const hours = moment(this.appointment.deadline).diff(moment(), 'hours');
        if (hours < 0) {
            return null;
        }
        return hours <= HOURS_BEFORE_DAYS
            ? this.translate.instant('appointment.inHours', { hours })
            : this.translate.instant('appointment.inDays', { days: Math.round(hours / 24) });
    }

    /** Past or canceled, as opposed to merely closed for registration. */
    isPast(): boolean {
        return new Date(this.appointment.scheduling).getTime() < new Date().getTime()
            || this.appointment.state === State.CANCELED;
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
        if (new Date(this.appointment.scheduling).getTime() < new Date().getTime() || this.appointment.state == State.CANCELED) {
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

        const deadline = moment(appointment.deadline).tz(this.school.timezone);
        const now = moment().tz(this.school.timezone);
        return deadline.isBefore(now);
    }

    close() {
        return this.modalCtrl.dismiss({ hasChange: this.hasChanges });
    }

}
