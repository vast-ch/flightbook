import { Component, OnInit, OnDestroy } from '@angular/core';
import { LoadingController, AlertController, IonContent, IonFooter, IonIcon, IonInput, IonButton } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { User } from 'src/app/account/shared/user.model';
import { AccountService } from '../shared/account.service';
import { FormsModule } from '@angular/forms';
import { PhoneNumberComponent } from 'src/app/shared/components/phone-number/phone-number.component';

@Component({
    selector: 'app-register',
    templateUrl: './register.page.html',
    styleUrls: ['./register.page.scss'],
    imports: [
        FormsModule,
        TranslateModule,
        IonContent,
        IonFooter,
        IonIcon,
        IonInput,
        IonButton,
        PhoneNumberComponent
    ]
})
export class RegisterPage implements OnInit, OnDestroy {
    unsubscribe$ = new Subject<void>();
    registerData: User;
    showPassword = false;

    constructor(
        private router: Router,
        private translate: TranslateService,
        private accountService: AccountService,
        private loadingCtrl: LoadingController,
        private alertController: AlertController
    ) {
        this.registerData = new User();
        addIcons({ arrowBack, eyeOutline, eyeOffOutline });
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    togglePassword() {
        this.showPassword = !this.showPassword;
    }

    close() {
        this.router.navigate(['/login']);
    }

    async saveRegister(registerForm: any) {
        if (registerForm.valid) {
            const loading = await this.loadingCtrl.create({
                message: this.translate.instant('loading.createaccount')
            });
            await loading.present();
            this.accountService.register(this.registerData).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: User) => {
                await loading.dismiss();
                const alert = await this.alertController.create({
                    header: this.translate.instant('account.register'),
                    message: this.translate.instant('message.registrationSuccess'),
                    buttons: [this.translate.instant('buttons.done')]
                });
                await alert.present();
                await this.router.navigate(['/login'], { replaceUrl: true });
            },
                (async (error: any) => {
                    await loading.dismiss();
                    if (error.status === HttpStatusCode.CONFLICT) {
                        const alert = await this.alertController.create({
                            header: this.translate.instant('account.register'),
                            message: this.translate.instant('message.userExist'),
                            buttons: [this.translate.instant('buttons.done')]
                        });
                        await alert.present();
                    }
                })
            );
        } else {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.errortitle'),
                message: this.translate.instant('message.mendatoryFields'),
                buttons: [this.translate.instant('buttons.done')]
            });
            await alert.present();
        }
    }

}
