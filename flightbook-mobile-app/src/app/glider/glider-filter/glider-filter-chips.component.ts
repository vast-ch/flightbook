import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { GliderStore } from '../shared/glider.store';
import { LanguageService } from 'src/app/shared/services/language.service';

type Chip = { label: string; clear: () => void };

/**
 * What the glider filter is narrowing by, one removable chip per criterion -
 * the counterpart to fb-filter-chips on Flights. Without it the only sign of a
 * filter was the word "filtered" in the eyebrow, which said nothing about what
 * was hidden and gave no way back short of reopening the sheet.
 *
 * Separate from fb-filter-chips rather than shared with it: the row of chips is
 * the same, but every label and every clear is specific to this filter's fields.
 * The presentation lives in tokens.scss, which both use.
 */
@Component({
    selector: 'fb-glider-filter-chips',
    standalone: true,
    imports: [TranslateModule, IonIcon],
    template: `
        @if (chips().length > 0) {
            <div class="fb-chip-row filter-summary filter-summary--spaced">
                @for (chip of chips(); track chip.label) {
                    <button type="button" class="fb-chip fb-chip--removable"
                            (click)="chip.clear(); changed.emit()">
                        {{ chip.label }}
                        <ion-icon name="close" aria-hidden="true"></ion-icon>
                    </button>
                }
                <button type="button" class="filter-summary__clear" (click)="clearAll()">
                    {{ 'filter.clearAll' | translate }}
                </button>
            </div>
        }
    `
})
export class GliderFilterChipsComponent {
    private gliderStore = inject(GliderStore);
    private translate = inject(TranslateService);
    private languageService = inject(LanguageService);

    /** Fires after a criterion is dropped, so the host can refetch. */
    @Output() changed = new EventEmitter<void>();

    constructor() {
        addIcons({ close });
    }

    public chips = computed<Chip[]>(() => {
        const filter = this.gliderStore.filter();
        // The labels come from translate.instant(), a plain call - without
        // reading the language signal they would keep the previous language's
        // wording after a switch.
        this.languageService.lang();
        const chips: Chip[] = [];

        // Brand and name are free text, and a bare value would not say which
        // field it came from - "Ozone" could be either.
        if (filter.brand) {
            chips.push({
                label: `${this.translate.instant('glider.brand')}: ${filter.brand}`,
                clear: () => this.gliderStore.updateFilter({ brand: '' })
            });
        }

        if (filter.name) {
            chips.push({
                label: `${this.translate.instant('glider.name')}: ${filter.name}`,
                clear: () => this.gliderStore.updateFilter({ name: '' })
            });
        }

        if (filter.type) {
            chips.push({
                label: this.translate.instant(filter.type === '1' ? 'glider.tandem' : 'glider.solo'),
                clear: () => this.gliderStore.updateFilter({ type: '' })
            });
        }

        if (filter.archived) {
            const state = this.translate.instant(filter.archived === '1' ? 'buttons.yes' : 'buttons.no');
            chips.push({
                label: `${this.translate.instant('glider.archived')}: ${state}`,
                clear: () => this.gliderStore.updateFilter({ archived: '' })
            });
        }

        return chips;
    });

    clearAll() {
        this.gliderStore.resetFilter();
        this.changed.emit();
    }
}
