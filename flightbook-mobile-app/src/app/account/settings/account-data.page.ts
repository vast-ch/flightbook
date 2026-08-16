import { Component, OnDestroy, OnInit, effect } from '@angular/core';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AlertController, LoadingController, NavController, IonContent, IonButton, IonIcon, IonInput, IonTextarea, IonToggle } from '@ionic/angular/standalone';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { User } from 'src/app/account/shared/user.model';
import { AccountService } from '../shared/account.service';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { PaymentService } from 'src/app/shared/services/payment.service';
import { SessionService } from 'src/app/shared/services/session.service';
import { LanguageService } from 'src/app/shared/services/language.service';
import { PaymentStatus } from '../shared/paymentStatus.model';
import { SchoolService } from 'src/app/school/shared/school.service';
import { EmergencyContact } from 'src/app/school/shared/emergency-contact.model';
import { Capacitor } from '@capacitor/core';
import { ActivatedRoute, Router } from '@angular/router';
import moment from 'moment';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { chevronBack, eyeOutline, eyeOffOutline, checkmark } from 'ionicons/icons';
import { environment } from 'src/environments/environment';
import { PhoneNumberComponent } from 'src/app/shared/components/phone-number/phone-number.component';
import { Location } from '@angular/common';
import { navigateBackOrTo } from 'src/app/shared/util/back-navigation';

/** The four languages the app ships strings for, in the design's order. */
const LANGUAGES = ['fr', 'de', 'en', 'it'];

@Component({
    selector: 'app-account-data',
    templateUrl: './account-data.page.html',
    styleUrls: ['./account-data.page.scss'],
    imports: [
        FormsModule,
        DatePipe,
        TranslateModule,
        IonContent,
        IonButton,
        IonIcon,
        IonInput,
        IonTextarea,
        IonToggle,
        PhoneNumberComponent
    ]
})
export class AccountDataPage implements OnInit, OnDestroy {
    unsubscribe$ = new Subject<void>();

    user: User;
    /** The API is a list, the UI a singleton; the id keeps POST an upsert. */
    emergencyContact = new EmergencyContact();
    paymentStatus: PaymentStatus;
    isNative: boolean;
    appVersion = environment.appVersion;

    public readonly languages = LANGUAGES;

    /** Password is its own action, so it keeps its own model and reveal state. */
    pwd = { oldPassword: '', newPassword: '', newPassword2: '' };
    showOldPassword = false;
    showNewPassword = false;
    showRepeatPassword = false;

    constructor(
        private translate: TranslateService,
        private accountService: AccountService,
        private schoolService: SchoolService,
        private sessionService: SessionService,
        private languageService: LanguageService,
        private alertController: AlertController,
        private loadingCtrl: LoadingController,
        public navCtrl: NavController,
        private location: Location,
        private router: Router,
        private paymentService: PaymentService,
        private route: ActivatedRoute
    ) {
        this.isNative = Capacitor.isNativePlatform();
        addIcons({ 'chevron-back': chevronBack, 'eye-outline': eyeOutline, 'eye-off-outline': eyeOffOutline, checkmark });

        // Deep clone: edits must not touch the signal until a save succeeds.
        effect(() => {
            this.user = this.withConfig(structuredClone(this.accountService.currentUser$()));
        });

        this.paymentService.getPaymentStatus().pipe(takeUntil(this.unsubscribe$)).subscribe((paymentStatus: PaymentStatus) => {
            this.paymentStatus = paymentStatus;
        });

        if (this.route.snapshot.paramMap.get('payment') === 'success') {
            this.paymentSuccess();
        }
    }

    ngOnInit() {
        this.loadEmergencyContact();
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    // ---- View state -----------------------------------------------------

    get currentLang(): string {
        return this.languageService.lang();
    }

    get initials(): string {
        if (!this.user) {
            return '';
        }
        return `${this.user.firstname?.charAt(0) ?? ''}${this.user.lastname?.charAt(0) ?? ''}`.toUpperCase();
    }

    /** EXEMPTED is entitled but not paying, so it reads as Free here. */
    get isPremium(): boolean {
        return !!this.paymentStatus?.active && this.paymentStatus?.state !== 'EXEMPTED';
    }

    /** Stripe checkout is web-only; native builds have no purchase path. */
    get canSubscribe(): boolean {
        return !this.isNative && !this.isPremium;
    }

    get showUpsell(): boolean {
        return !this.isPremium;
    }

    // ---- Actions --------------------------------------------------------

    close() {
        navigateBackOrTo(this.navCtrl, this.location, 'more');
    }

    /**
     * The template binds into config three levels deep, and an account that has
     * never saved a setting comes back without it - so fill the shape in rather
     * than guard every binding.
     */
    private withConfig(user: User | null): User | null {
        if (!user) {
            return user;
        }
        user.config = user.config ?? {};
        user.config.notifications = user.config.notifications ?? {};
        user.config.notifications.email = user.config.notifications.email ?? {};
        user.config.preparation = user.config.preparation ?? {};
        user.config.preparation.links = user.config.preparation.links ?? [];
        return user;
    }

    private loadEmergencyContact() {
        this.schoolService.getEmergencyContacts().pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: (contacts: EmergencyContact[]) => {
                if (contacts?.length > 0) {
                    this.emergencyContact = contacts[0];
                }
            }
        });
    }

    /**
     * Saves the profile and the emergency contact. Two endpoints, so each
     * reports its own failure rather than one aborting the other.
     */
    async saveChanges() {
        // Checked before anything is sent: the emergency-contact page this block
        // replaced marked firstname/lastname/phone `required` and disabled
        // submit. Those columns are NOT NULL, so a half-filled block used to
        // POST a row the database rejects, surfacing as a generic error with no
        // hint which field was missing.
        if (this.emergencyContactState === 'partial') {
            await this.alert(
                this.translate.instant('message.errortitle'),
                this.translate.instant('message.mendatoryFields')
            );
            return;
        }

        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.saveaccount')
        });
        await loading.present();

        let userError: any = null;
        try {
            await firstValueFrom(this.accountService.updateUser(this.user));
        } catch (error) {
            userError = error;
        }

        let contactError: any = null;
        if (this.emergencyContactState === 'complete') {
            try {
                this.emergencyContact = await firstValueFrom(
                    this.schoolService.postEmergencyContact(this.emergencyContact)
                );
            } catch (error) {
                contactError = error;
            }
        }

        await loading.dismiss();

        if (userError) {
            const message = userError.status === HttpStatusCode.CONFLICT
                ? this.translate.instant('message.userExist')
                : this.translate.instant('message.error');
            await this.alert(this.translate.instant('message.infotitle'), message);
            return;
        }

        if (contactError) {
            await this.alert(this.translate.instant('message.infotitle'), this.translate.instant('message.error'));
        }
    }

    /**
     * An untouched block must not create an empty record, and a half-filled one
     * must not be sent at all: firstname, lastname and phone are NOT NULL
     * server-side, and the DTO carries no validators to reject it politely.
     */
    private get emergencyContactState(): 'empty' | 'partial' | 'complete' {
        const contact = this.emergencyContact;
        const required = [contact?.firstname, contact?.lastname, contact?.phone];
        const filled = required.filter(value => !!value).length;
        if (filled === required.length) {
            return 'complete';
        }
        const touched = filled > 0 || !!contact?.additionalInformation || !!contact?.id;
        return touched ? 'partial' : 'empty';
    }

    async changePassword() {
        const { oldPassword, newPassword, newPassword2 } = this.pwd;

        if (!oldPassword || !newPassword || !newPassword2) {
            await this.alert(this.translate.instant('message.errortitle'), this.translate.instant('message.mendatoryFields'));
            return;
        }

        if (newPassword !== newPassword2) {
            await this.alert(this.translate.instant('login.password'), this.translate.instant('message.pwdNotSame'));
            return;
        }

        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.saveaccount')
        });
        await loading.present();

        this.accountService.updatePassword(this.pwd).pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: async () => {
                await loading.dismiss();
                this.pwd = { oldPassword: '', newPassword: '', newPassword2: '' };
                await this.alert(this.translate.instant('login.password'), this.translate.instant('message.passwordchanged'));
            },
            error: async (error: any) => {
                await loading.dismiss();
                const message = error.status === HttpStatusCode.FORBIDDEN
                    ? this.translate.instant('message.pwdWrong')
                    : this.translate.instant('message.error');
                await this.alert(this.translate.instant('login.password'), message);
            }
        });
    }

    setLanguage(lang: string) {
        this.languageService.setLanguage(lang);
    }

    async paymentSuccess() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.infotitle'),
            message: this.translate.instant('payment.thanks'),
            buttons: [{
                text: this.translate.instant('buttons.done'),
                handler: () => {
                    this.paymentService.setPaymentStatus({ active: true, state: 'ACTIVE', expires_date: moment().add(1, 'year').toDate() });
                }
            }]
        });
        await alert.present();
    }

    async getStripeSession() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        try {
            const session = await firstValueFrom(this.accountService.getStripeSession());
            window.open(session.url, '_self');
        } catch {
            await this.alert(this.translate.instant('message.infotitle'), this.translate.instant('message.error'));
        } finally {
            // Previously left spinning, which stranded the page on a failure.
            await loading.dismiss();
        }
    }

    async cancelSubscription() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.warning'),
            message: this.translate.instant('message.cancelPymentSubscription'),
            buttons: [
                {
                    text: this.translate.instant('buttons.yes'),
                    handler: async () => {
                        const loading = await this.loadingCtrl.create({
                            message: this.translate.instant('loading.loading')
                        });
                        await loading.present();

                        this.accountService.cancelPaymentSubscription().pipe(takeUntil(this.unsubscribe$)).subscribe({
                            next: () => {
                                this.paymentStatus.state = 'CANCELED';
                                loading.dismiss();
                            },
                            error: () => {
                                loading.dismiss();
                            }
                        });
                    }
                },
                { text: this.translate.instant('buttons.no') }
            ]
        });

        await alert.present();
    }

    async logout() {
        this.sessionService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: () => this.router.navigate(['login'], { replaceUrl: true }),
            error: () => this.router.navigate(['login'], { replaceUrl: true })
        });
    }

    async deleteAccount() {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.warning'),
            message: this.translate.instant('message.deleteAccount'),
            buttons: [
                {
                    text: this.translate.instant('buttons.yes'),
                    handler: async () => {
                        this.accountService.deleteUser().pipe(takeUntil(this.unsubscribe$)).subscribe({
                            next: () => {
                                this.sessionService.clearLocalSession();
                                this.navCtrl.navigateRoot('login');
                            }
                        });
                    }
                },
                { text: this.translate.instant('buttons.no') }
            ]
        });

        await alert.present();
    }

    private async alert(header: string, message: string) {
        const alert = await this.alertController.create({
            header,
            message,
            buttons: [this.translate.instant('buttons.done')]
        });
        await alert.present();
    }
}
