import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { LoadingController, AlertController, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/angular/standalone';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from '../shared/place.store';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { addIcons } from 'ionicons';
import { chevronBack } from 'ionicons/icons';
import { PlaceFormComponent } from '../../form/place-form/place-form';

@Component({
    selector: 'app-place-edit',
    templateUrl: './place-edit.page.html',
    styleUrls: ['./place-edit.page.scss'],
    imports: [
        PlaceFormComponent,
        TranslateModule,
        IonContent,
        IonFooter,
        IonButton,
        IonIcon
    ]
})
export class PlaceEditPage implements OnDestroy {
    unsubscribe$ = new Subject<void>();
    private readonly placeId: number;
    place: Place;
    deleteDisabled: boolean;

    constructor(
        private activeRoute: ActivatedRoute,
        private router: Router,
        private placeStore: PlaceStore,
        private flightStore: FlightStore,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private alertController: AlertController
    ) {
        this.deleteDisabled = true;
        this.placeId = +this.activeRoute.snapshot.paramMap.get('id');
        this.place = this.placeStore.places().find(place => place.id === this.placeId);
        this.place = structuredClone(this.place);
        if (!this.place) {
            this.router.navigate(['/places'], { replaceUrl: true });
        }
        this.flightStore.nbFlightsByPlaceId(this.placeId).subscribe((resp: any) => {
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
        this.router.navigate(['/places'], { replaceUrl: true });
    }

    async savePlace(place: Place) {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.saveplace')
        });
        await loading.present();

        this.placeStore.putPlace(place).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Place) => {
            this.flightStore.clearFlights();
            await loading.dismiss();
            this.router.navigate(['/places'], { replaceUrl: true });
        },
            (async (error: any) => {
                await loading.dismiss();
                if (error.status === HttpStatusCode.CONFLICT) {
                    const alert = await this.alertController.create({
                        header: this.translate.instant('place.place'),
                        message: this.translate.instant('message.placeExist'),
                        buttons: [this.translate.instant('buttons.done')]
                    });
                    await alert.present();
                }
            })
        );
    }

    async delete() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.deleteplace')
        });
        await loading.present();

        this.placeStore.deletePlace(this.place).subscribe(async (res: any) => {
            await loading.dismiss();
            await this.router.navigate(['/places'], { replaceUrl: true });
        },
            (async (error: any) => {
                await loading.dismiss();
                if (error.status === HttpStatusCode.CONFLICT) {
                    const alert = await this.alertController.create({
                        header: this.translate.instant('place.place'),
                        message: this.translate.instant('message.deleteError'),
                        buttons: [this.translate.instant('buttons.done')]
                    });
                    await alert.present();
                }
            })
        );
    }
}
