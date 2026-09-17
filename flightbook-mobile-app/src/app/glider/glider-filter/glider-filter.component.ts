import { Component, OnDestroy, signal } from '@angular/core';
import { ModalController, IonContent, IonInput, IonSelect, IonSelectOption, IonButton } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { GliderStore } from '../shared/glider.store';
import { Glider } from '../shared/glider.model';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';

@Component({
    selector: 'app-glider-filter',
    templateUrl: './glider-filter.component.html',
    styleUrls: ['./glider-filter.component.scss'],
    imports: [
        FormsModule,
        TranslateModule,
        IonContent,
        IonInput,
        IonSelect,
        IonSelectOption,
        IonButton
    ]
})
export class GliderFilterComponent implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    /** The store's own signal, edited live - same grammar as the flight and appointment filters. */
    public filter = this.gliderStore.filter;
    public isFiltered = this.gliderStore.filtered;

    /** Manufacturers to choose from, gathered from the pilot's own gliders. */
    public brands = signal<string[]>([]);

    constructor(
        private modalCtrl: ModalController,
        private gliderStore: GliderStore
    ) {
        addIcons({ 'chevron-forward': chevronForward });

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
        if (this.filter().brand) {
            brands.add(this.filter().brand);
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

    setBrand(brand: string) {
        this.gliderStore.updateFilter({ brand });
    }

    setName(name: string) {
        this.gliderStore.updateFilter({ name: name ?? '' });
    }

    setType(type: string) {
        this.gliderStore.updateFilter({ type });
    }

    setArchived(archived: string) {
        this.gliderStore.updateFilter({ archived });
    }

    clearFilter() {
        this.gliderStore.resetFilter();
    }

    close() {
        return this.modalCtrl.dismiss();
    }
}
