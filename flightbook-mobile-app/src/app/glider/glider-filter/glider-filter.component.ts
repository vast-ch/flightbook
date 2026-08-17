import { Component, OnDestroy, Input } from '@angular/core';
import { ModalController, LoadingController, IonInfiniteScroll, IonContent, IonFooter, IonInput, IonSelect, IonSelectOption, IonButton, IonIcon } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { GliderFilter } from 'src/app/glider/shared/glider-filter.model';
import { GliderStore } from '../shared/glider.store';
import { Glider } from '../shared/glider.model';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { close, chevronForward } from 'ionicons/icons';

@Component({
    selector: 'app-glider-filter',
    templateUrl: './glider-filter.component.html',
    styleUrls: ['./glider-filter.component.scss'],
    imports: [
        FormsModule,
        TranslateModule,
        IonContent,
        IonFooter,
        IonInput,
        IonSelect,
        IonSelectOption,
        IonButton,
        IonIcon
    ]
})
export class GliderFilterComponent implements OnDestroy {
    @Input() infiniteScroll: IonInfiniteScroll;
    private unsubscribe$ = new Subject<void>();
    public filter: GliderFilter;

    constructor(
        private modalCtrl: ModalController,
        private gliderStore: GliderStore,
        private loadingCtrl: LoadingController,
        private translate: TranslateService
    ) {
        // A copy, not the store's own object: editing the fields and then
        // dismissing must not leave the store filtered by what was typed.
        this.filter = Object.assign(new GliderFilter(), this.gliderStore.filter);
        addIcons({ close, 'chevron-forward': chevronForward });
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    /** Leaves without touching the store's filter. */
    dismiss() {
        this.modalCtrl.dismiss({ dismissed: true });
    }

    async filterElement() {
        this.gliderStore.filter = this.filter;
        this.applyAndClose();
    }

    clearFilter() {
        this.filter = new GliderFilter();
        this.gliderStore.filter = this.filter;
        this.applyAndClose();
    }

    private async applyAndClose() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = false;
        }

        this.gliderStore.getGliders({ limit: this.gliderStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(async (res: Glider[]) => {
                await loading.dismiss();
                this.modalCtrl.dismiss({
                    dismissed: true
                });
            }, async (error: any) => {
                await loading.dismiss();
            });
    }
}
