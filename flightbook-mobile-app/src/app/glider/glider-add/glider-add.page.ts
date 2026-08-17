import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoadingController, AlertController, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { Glider } from '../shared/glider.model';
import { GliderStore } from '../shared/glider.store';
import moment from 'moment';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { GliderFormComponent } from '../../form/glider-form/glider-form';

@Component({
    selector: 'app-glider-add',
    templateUrl: './glider-add.page.html',
    styleUrls: ['./glider-add.page.scss'],
    imports: [
        GliderFormComponent,
        TranslateModule,
        IonContent,
        IonFooter,
        IonButton,
        IonIcon
    ]
})
export class GliderAddPage implements OnDestroy {
    unsubscribe$ = new Subject<void>();
    glider: Glider;

    constructor(
        private router: Router,
        private gliderStore: GliderStore,
        private loadingCtrl: LoadingController,
        private alertController: AlertController,
        private translate: TranslateService
    ) {
        this.glider = new Glider();
        addIcons({ close });
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    close() {
        this.router.navigate(['/gliders'], { replaceUrl: true });
    }

    async saveGlider(glider: Glider) {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.saveglider')
        });
        await loading.present();

        if (glider.buyDate) {
            glider.buyDate = moment(glider.buyDate).format('YYYY-MM-DD');
        }

        this.gliderStore.postGlider(glider).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Glider) => {
            await loading.dismiss();
            await this.router.navigate(['/gliders'], { replaceUrl: true });
        },
            (async (resp: any) => {
                await loading.dismiss();
                if (resp.status === HttpStatusCode.UNPROCESSABLE_ENTITY) {
                    const alert = await this.alertController.create({
                        header: this.translate.instant('message.infotitle'),
                        message: resp.error.message,
                        buttons: [this.translate.instant('buttons.done')]
                    });
                    await alert.present();
                }
            })
        );
    }
}
