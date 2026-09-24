import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoadingController, AlertController, IonContent, IonFooter, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import HttpStatusCode from '../../shared/util/HttpStatusCode';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from '../shared/place.store';
import { NavigationService } from 'src/app/shared/services/navigation.service';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { PlaceFormComponent } from '../../form/place-form/place-form';

@Component({
    selector: 'app-place-add',
    templateUrl: './place-add.page.html',
    styleUrls: ['./place-add.page.scss'],
    imports: [
        PlaceFormComponent,
        TranslateModule,
        IonContent,
        IonFooter,
        IonButton,
        IonIcon
    ]
})
export class PlaceAddPage implements OnDestroy {
    unsubscribe$ = new Subject<void>();
    place: Place;

    constructor(
        private navigationService: NavigationService,
        private translate: TranslateService,
        private placeStore: PlaceStore,
        private loadingCtrl: LoadingController,
        private alertController: AlertController
    ) {
        this.place = new Place();
        addIcons({ close });
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    close() {
        this.navigationService.back('/places');
    }

    async savePlace(place: Place) {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.saveplace')
        });
        await loading.present();

        this.placeStore.postPlace(place).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Place) => {
            await loading.dismiss();
            await this.navigationService.back('/places');
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
}
