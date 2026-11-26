import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';

import { AlertController, IonicSafeString, IonApp, IonRouterOutlet } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { AccountService } from './account/shared/account.service';
import { SchoolService } from './school/shared/school.service';
import { SessionService } from './shared/services/session.service';
import { resolveLanguage } from './shared/services/language.service';
import { LoginPage } from './account/login/login.page';
import {
    ActionPerformed,
    PushNotificationSchema,
    PushNotifications,
    Token,
} from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { keyboardOverlaysWebview, rememberKeyboardHeight } from './shared/util/keyboard';
import { Router } from '@angular/router';
import { RegisterPage } from './account/register/register.page';
import { PaymentStatus } from './account/shared/paymentStatus.model';
import { PaymentService } from './shared/services/payment.service';
import { firstValueFrom, Subject } from 'rxjs';
import { addIcons } from "ionicons";
import { cloudUpload, copy } from 'ionicons/icons';
import { LoadingScreenComponent } from './shared/components/loading-screen/loading-screen.component';


@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        IonApp,
        IonRouterOutlet,
        LoadingScreenComponent,
    ],
})
export class AppComponent implements OnDestroy, OnInit {
    unsubscribe$ = new Subject<void>();

    /**
     * The boot screen covers the window the router needs to decide where to go:
     * ForceUpdateGuard's version check, then AuthGuardService.isAuth(), which on
     * an expired token spends a refresh round-trip. Neither has an HTTP timeout,
     * so on a bad connection that window is long - and used to be a blank shell,
     * because the two module-scope `SplashScreen.hide()` timers this replaces
     * fired when their chunk was parsed rather than when anything was ready.
     */
    bootVisible = signal(true);

    private bootStartedAt = Date.now();
    private bootFinishing = false;

    constructor(
        private router: Router,
        private translate: TranslateService,
        private accountService: AccountService,
        private schoolService: SchoolService,
        private alertController: AlertController,
        private paymentService: PaymentService,
        private sessionService: SessionService
    ) {
        this.translate.setDefaultLang('en');
        // Narrowed to a language we ship: an unsupported code sticks in
        // translate.currentLang even though its bundle 404s, and every DatePipe
        // given that locale then throws NG0701 on each change-detection pass.
        this.translate.use(resolveLanguage(localStorage.getItem('language') || navigator.language));

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
        // No StatusBar.setOverlaysWebView({ overlay: false }) here: the page
        // headers pad themselves with env(safe-area-inset-top) and expect to
        // draw under the status bar. Android 15+ forces that anyway; forcing it
        // off on older versions left a band in the native window background
        // (dark grey in dark mode) above the white headers. The bar icons are
        // pinned dark by `"style": "LIGHT"` in capacitor.config.json, because
        // the plugins' DEFAULT follows the OS theme and this app is light-only.
        this.hideNativeSplash();
        this.trackKeyboardHeight();
    }

    /**
     * Publishes the native keyboard height as --fb-keyboard-height (plus an
     * .fb-keyboard-open class), which tokens.scss uses to add scroll room at the
     * bottom of every ion-content and to lift ion-footer above the keyboard.
     * Needed because Keyboard.resize is "none": the keyboard covers the webview
     * rather than shrinking it, and Ionic only pads the content when the focused
     * input had to be scrolled - see the comment on the rule in tokens.scss.
     */
    private trackKeyboardHeight() {
        // iOS only: Android resizes the webview for the keyboard, so the footer
        // already sits on it and the content already has its scroll room.
        if (!keyboardOverlaysWebview()) {
            return;
        }
        const root = document.documentElement;
        Keyboard.addListener('keyboardWillShow', (info) => {
            root.style.setProperty('--fb-keyboard-height', `${info.keyboardHeight}px`);
            root.classList.add('fb-keyboard-open');
            rememberKeyboardHeight(info.keyboardHeight);
        });
        Keyboard.addListener('keyboardWillHide', () => {
            root.style.removeProperty('--fb-keyboard-height');
            root.classList.remove('fb-keyboard-open');
        });
    }

    subscribeToEmmiter(componentRef: any) {
        // Before the guard below: login and register are legitimate first
        // screens, so the boot screen has to lift for them too.
        this.finishBoot();

        if (componentRef instanceof LoginPage || componentRef instanceof RegisterPage || this.sessionService.sessionBootstrapped) {
            return;
        }

        // Populates schoolsSignal, which Home and More both read. Caught:
        // getSchools() memoises a promise, so a failed bootstrap request would
        // otherwise surface as an unhandled rejection - the pages that need the
        // list ask again themselves.
        this.schoolService.getSchools().catch(() => { /* the pages retry */ });

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

    /**
     * Lifts the boot screen once the first page has activated, but not before
     * MIN_BOOT_MS has passed: a warm start resolves in about a tenth of a
     * second, and a screen that flashes one status line and vanishes reads as a
     * glitch rather than a splash.
     */
    private finishBoot() {
        if (this.bootFinishing) {
            return;
        }
        this.bootFinishing = true;

        const shown = Date.now() - this.bootStartedAt;
        setTimeout(() => this.bootVisible.set(false), Math.max(0, AppComponent.MIN_BOOT_MS - shown));
    }

    /** How long the boot screen stays up even when there is nothing left to wait for. */
    private static readonly MIN_BOOT_MS = 900;

    /**
     * Hands the native splash over to the boot screen. Deferred a frame so the
     * webview has painted it first - hiding on the same tick shows a white gap
     * between the two. capacitor.config.json sets launchAutoHide: false, so
     * until this runs the native splash is what is on screen.
     */
    private hideNativeSplash() {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        requestAnimationFrame(() => {
            SplashScreen.hide().catch(() => { /* already hidden, or unavailable */ });
        });
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
                    message: (notification.body ?? '').replace(/\r?\n/g, '<br/>'),
                    backdropDismiss: false,
                    buttons: [
                        {
                            text: this.translate.instant('buttons.done'),
                            handler: () => {
                                // The user is looking at the list the deleted appointment is still in.
                                const data = notification.data;
                                if (data?.type == 'APPOINTMENT_DELETED' && this.router.url.split('?')[0] == `/more/school/${data.schoolId}`) {
                                    this.openAppointmentList(data.schoolId);
                                }
                            }
                        },
                        {
                            text: this.translate.instant('buttons.show'),
                            handler: () => {
                                // The alert above already was the message.
                                this.openNotificationTarget(notification.data, false);
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
                this.openNotificationTarget(notification.notification.data, true);
            }
        );
    }

    /**
     * Opens the page a push notification is about.
     * @param tapped true when the user tapped it in the tray and has not read
     * its text inside the app yet.
     */
    private async openNotificationTarget(data: any, tapped: boolean) {
        const type = data?.type;
        if (type == 'APPOINTMENT') {
            this.router.navigate(
                ['/more/school/', data.schoolId],
                { queryParams: { appointmentId: data.appointmentId } }
            );
        } else if (type == 'APPOINTMENT_DELETED') {
            // There is no appointment left to open: the school's list it is.
            await this.openAppointmentList(data.schoolId);
            if (tapped) {
                await this.presentAppointmentDeletedAlert(data);
            }
        } else if (type == 'FLIGHT_VALIDATION_REJECTED' || type == 'FLIGHT_PAYMENT_REJECTED' || type == 'FLIGHT_PAYMENT_ACCEPTED') {
            this.router.navigate(['/flights/', data.flightId]);
        }
    }

    /** `refresh` makes the list reload even when it is already open or still alive in the stack. */
    private openAppointmentList(schoolId: string) {
        return this.router.navigate(['/more/school/', schoolId], { queryParams: { refresh: Date.now() } });
    }

    private async presentAppointmentDeletedAlert(data: any) {
        const alert = await this.alertController.create({
            header: data.title || this.translate.instant('appointment.deletedTitle'),
            message: (data.body || this.translate.instant('appointment.deletedMessage')).replace(/\r?\n/g, '<br/>'),
            backdropDismiss: false,
            buttons: [
                {
                    text: this.translate.instant('buttons.done')
                }
            ]
        });
        await alert.present();
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }
}
