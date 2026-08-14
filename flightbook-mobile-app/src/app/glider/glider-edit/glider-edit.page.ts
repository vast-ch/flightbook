import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoadingController, AlertController, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { Glider } from '../shared/glider.model';
import { GliderStore } from '../shared/glider.store';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import moment from 'moment';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { GliderFormComponent } from '../../form/glider-form/glider-form';

@Component({
    selector: 'app-glider-edit',
    templateUrl: './glider-edit.page.html',
    styleUrls: ['./glider-edit.page.scss'],
    imports: [
        GliderFormComponent,
        TranslateModule,
        IonContent,
        IonFooter,
        IonButton,
        IonIcon
    ]
})
export class GliderEditPage implements OnDestroy {
    unsubscribe$ = new Subject<void>();
    private gliderId: number;
    glider: Glider;
    deleteDisabled: boolean;

    constructor(
        private activeRoute: ActivatedRoute,
        private router: Router,
        private gliderStore: GliderStore,
        private flightStore: FlightStore,
        private loadingCtrl: LoadingController,
        private alertController: AlertController,
        private translate: TranslateService
    ) {
        this.deleteDisabled = true;
        this.gliderId = +this.activeRoute.snapshot.paramMap.get('id');
        this.glider = this.gliderStore.gliders().find(glider => glider.id === this.gliderId);
        this.glider = structuredClone(this.glider);
        if (!this.glider) {
            this.router.navigate(['/gliders'], { replaceUrl: true });
        }
        this.flightStore.nbFlightsByGliderId(this.gliderId).subscribe((resp: any) => {
            if (resp.nbFlights == 0) {
                this.deleteDisabled = false;
            }
        });
        addIcons({ 'chevron-back': chevronBack });
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

        this.gliderStore.putGlider(glider).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Glider) => {
            this.flightStore.clearFlights();
            await loading.dismiss();
            this.router.navigate(['/gliders'], { replaceUrl: true });
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

    async delete() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.deleteglider')
        });
        await loading.present();

        this.gliderStore.deleteGlider(this.glider).subscribe(async (res: any) => {
            await loading.dismiss();
            await this.router.navigate(['/gliders'], { replaceUrl: true });
        },
            (async (error: any) => {
                await loading.dismiss();
                if (error.status === HttpStatusCode.UNPROCESSABLE_ENTITY) {
                    const alert = await this.alertController.create({
                        header: this.translate.instant('groupname.glider'),
                        message: this.translate.instant('message.deleteError'),
                        buttons: [this.translate.instant('buttons.done')]
                    });
                    await alert.present();
                }
            })
        );
    }
}
