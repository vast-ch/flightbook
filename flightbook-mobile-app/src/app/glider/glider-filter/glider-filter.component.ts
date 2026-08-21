import { Component, OnDestroy, Input, signal } from '@angular/core';
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

    /** Manufacturers to choose from, gathered from the pilot's own gliders. */
    public brands = signal<string[]>([]);

    constructor(
        private modalCtrl: ModalController,
        private gliderStore: GliderStore,
        private loadingCtrl: LoadingController,
        private translate: TranslateService
    ) {
        // A copy, not the store's own object: editing the fields and then
        // dismissing must not leave the store filtered by what was typed.
        this.filter = Object.assign(new GliderFilter(), this.gliderStore.filter());
        addIcons({ close, 'chevron-forward': chevronForward });

        // Seeded with the current choice so the control shows it immediately, and
        // still shows it if the request below no longer returns that brand.
        this.brands.set(this.mergeBrands([]));
        // applyFilter: false - narrowed by the brand already chosen, the list
        // would collapse to that one and there would be no way to pick another.
        this.gliderStore.getGliders({ store: false, applyFilter: false })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: (gliders: Glider[]) => this.brands.set(this.mergeBrands(gliders)),
                // The text fields still work; only the choices are missing.
                error: () => { }
            });
    }

    /** Distinct, sorted, and never dropping the brand already filtered on. */
    private mergeBrands(gliders: Glider[]): string[] {
        const brands = new Set<string>();
        if (this.filter.brand) {
            brands.add(this.filter.brand);
        }
        for (const glider of gliders) {
            if (glider.brand) {
                brands.add(glider.brand);
            }
        }
        return [...brands].sort((a, b) => a.localeCompare(b));
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
        this.gliderStore.filter.set(this.filter);
        this.applyAndClose();
    }

    clearFilter() {
        this.filter = new GliderFilter();
        this.gliderStore.resetFilter();
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
