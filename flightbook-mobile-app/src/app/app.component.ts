import { Component, effect, OnDestroy, OnInit } from '@angular/core';

import { AlertController, IonicSafeString } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { filter, takeUntil } from 'rxjs/operators';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AccountService } from './account/shared/account.service';
import { SchoolService } from './school/shared/school.service';
import { SessionService } from './shared/services/session.service';
import { LoginPage } from './account/login/login.page';
import {
    ActionPerformed,
    PushNotificationSchema,
    PushNotifications,
    Token,
} from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Router } from '@angular/router';
import { RegisterPage } from './account/register/register.page';
import { PaymentStatus } from './account/shared/paymentStatus.model';
import { PaymentService } from './shared/services/payment.service';
import { firstValueFrom, Subject } from 'rxjs';
import { addIcons } from "ionicons";
import { cloudUpload, copy } from 'ionicons/icons';


@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    standalone: false
})
export class AppComponent implements OnDestroy, OnInit {
    unsubscribe$ = new Subject<void>();

    constructor(
        private router: Router,
        private translate: TranslateService,
        private accountService: AccountService,
        private swUpdate: SwUpdate,
        private schoolService: SchoolService,
        private alertController: AlertController,
        private paymentService: PaymentService,
        private sessionService: SessionService
    ) {
        this.translate.setDefaultLang('en');
        this.translate.use(localStorage.getItem('language') || navigator.language.split('-')[0]);

        // Registered app-wide because the legacy pages that use them do not
        // register their own; each redesigned page registers what it needs.
        addIcons({
            cloudUpload,
            copy,
            'flight': 'assets/custom-ion-icons/flight.svg',
            'copyflight': 'assets/custom-ion-icons/copyflight.svg',
            'glider': 'assets/custom-ion-icons/glider.svg',
            'place': 'assets/custom-ion-icons/place.svg'
        });
    }

    async ngOnInit(): Promise<void> {
        // Fix EdgeToEdge header issue: ensure StatusBar overlaysWebView is false and set style
        try {
            if (Capacitor.isNativePlatform() && Capacitor.getPlatform() == "android") {
                await StatusBar.setOverlaysWebView({ overlay: false });
            }
        } catch (e) {
            // StatusBar not available or not supported
            console.warn('StatusBar plugin not available:', e);
        }

        if (this.swUpdate.isEnabled) {
            this.swUpdate.versionUpdates
                .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
                .subscribe(async evt => {
                    const alert = await this.alertController.create({
                        header: this.translate.instant('message.infotitle'),
                        message: this.translate.instant('message.newVersion'),
                        backdropDismiss: false,
                        buttons: [
                            {
                                text: this.translate.instant('buttons.done'),
                                handler: () => {
                                    document.location.reload();
                                }
                            }
                        ]
                    });
                    await alert.present();
                });
        }
    }

    subscribeToEmmiter(componentRef: any) {
        if (componentRef instanceof LoginPage || componentRef instanceof RegisterPage || this.sessionService.sessionBootstrapped) {
            return;
        }

        // Populates schoolsSignal, which Home and More both read.
        this.schoolService.getSchools();

        this.accountService.currentUser().pipe(takeUntil(this.unsubscribe$)).subscribe((user: any) => {});

        if (Capacitor.isNativePlatform()) {
            this.initPushNotification();
        }

        this.accountService.getPaymentStatus().pipe(takeUntil(this.unsubscribe$)).subscribe(async(paymentStatus: PaymentStatus) => {
            this.paymentService.setPaymentStatus(paymentStatus);
            if (paymentStatus?.state != 'EXEMPTED' && !paymentStatus.active && this.accountService.getLastLogin() == null) {
                localStorage.setItem('last_login', new Date().toISOString());
                const alert = await this.alertController.create({
                    header: this.translate.instant('message.infotitle'),
                    message: new IonicSafeString(this.translate.instant('payment.welcome')),
                    buttons: [{
                        text: this.translate.instant('buttons.done'),
                    }],
                });
                await alert.present();
            }
        })

        this.sessionService.markBootstrapped();
    }

    private initPushNotification() {
        PushNotifications.requestPermissions().then((result) => {
            if (result.receive === 'granted') {
                PushNotifications.register();
            } else {
                // Show some error
            }
        });

        PushNotifications.addListener('registration', (token: Token) => {
            // Push Notifications registered successfully.
            // Send token details to API to keep in DB.
            firstValueFrom(this.accountService.updateNotificationToken(token.value));
        });

        PushNotifications.addListener('registrationError', async (error: any) => {
            // Handle push notification registration error here.
            const alert = await this.alertController.create({
                header: this.translate.instant('message.warning'),
                message: this.translate.instant('message.notificationRegistrationFailed'),
                backdropDismiss: false,
                buttons: [
                    {
                        text: this.translate.instant('buttons.done')
                    }
                ]
            });
            await alert.present();
        });

        PushNotifications.addListener(
            'pushNotificationReceived',
            async (notification: PushNotificationSchema) => {
                // Show the notification payload if the app is open on the device.
                const alert = await this.alertController.create({
                    header: notification.title,
                    message: notification.body.replace('\r\n', '<br/>'),
                    backdropDismiss: false,
                    buttons: [
                        {
                            text: this.translate.instant('buttons.done')
                        },
                        {
                            text: this.translate.instant('buttons.show'),
                            handler: () => {
                                const type = notification.data.type
                                if (type == "APPOINTMENT") {
                                    const schoolId = notification.data.schoolId
                                    const appointmentId = notification.data.appointmentId
                                    this.router.navigate(
                                        ['/school/', schoolId],
                                        { queryParams: { appointmentId: appointmentId } }
                                    );
                                } else if (type == "FLIGHT_VALIDATION_REJECTED") {
                                    const flightId = notification.data.flightId
                                    this.router.navigate(
                                        ['/flights/', flightId]
                                    );
                                } else if (type == 'FLIGHT_PAYMENT_REJECTED' || type == 'FLIGHT_PAYMENT_ACCEPTED') {
                                    const flightId = notification.data.flightId
                                    this.router.navigate(
                                        ['/flights/', flightId]
                                    );
                                }
                            }
                        }
                    ]
                });
                await alert.present();
            }
        );

        PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (notification: ActionPerformed) => {
                // Action when user tap on a notification.
                const type = notification.notification.data.type
                if (type == "APPOINTMENT") {
                    const schoolId = notification.notification.data.schoolId
                    const appointmentId = notification.notification.data.appointmentId
                    this.router.navigate(
                        ['/school/', schoolId],
                        { queryParams: { appointmentId: appointmentId } }
                    );
                } else if (type == "FLIGHT_VALIDATION_REJECTED") {
                    const flightId = notification.notification.data.flightId
                    this.router.navigate(
                        ['/flights/', flightId]
                    );
                } else if (type == "FLIGHT_PAYMENT_REJECTED" || type == "FLIGHT_PAYMENT_ACCEPTED") {
                    const flightId = notification.notification.data.flightId
                    this.router.navigate(
                        ['/flights/', flightId]
                    );
                }
            }
        );
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }
}
