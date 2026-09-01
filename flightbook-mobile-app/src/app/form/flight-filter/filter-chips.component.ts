import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { LanguageService } from 'src/app/shared/services/language.service';
import { GliderStore } from 'src/app/glider/shared/glider.store';
import { Glider } from 'src/app/glider/shared/glider.model';
import { dateRangeLabel } from 'src/app/shared/util/format';

type Chip = { label: string; clear: () => void };

/**
 * What the shared flight filter is currently narrowing by, one removable chip
 * per criterion. Both Flights and Statistics show it, which is what keeps a
 * filtered number on either screen from looking like a wrong one.
 */
@Component({
    selector: 'fb-filter-chips',
    standalone: true,
    imports: [TranslateModule, IonIcon],
    templateUrl: './filter-chips.component.html'
    // .filter-summary* moved to tokens.scss when the glider list grew the same
    // row: two components draw it now, and neither owns the pattern.
})
export class FilterChipsComponent {
    private flightStore = inject(FlightStore);
    private gliderStore = inject(GliderStore);
    private translate = inject(TranslateService);
    private languageService = inject(LanguageService);

    /** Fires after a criterion is dropped, so the host can refetch. */
    @Output() changed = new EventEmitter<void>();

    constructor() {
        addIcons({ close });
    }

    public chips = computed<Chip[]>(() => {
        const filter = this.flightStore.filter();
        // Every label below comes from translate.instant(), which is a plain
        // call - without reading the language signal the chips would keep the
        // previous language's wording after a switch.
        this.languageService.lang();
        const chips: Chip[] = [];

        if (filter.from || filter.to) {
            chips.push({
                label: dateRangeLabel(filter.from, filter.to, key => this.translate.instant(key)),
                clear: () => this.flightStore.updateFilter({ from: null, to: null })
            });
        }

        if (filter.glider?.id) {
            chips.push({
                label: this.gliderLabel(filter.glider),
                clear: () => this.flightStore.updateFilter({ glider: new Glider() })
            });
        }

        if (filter.gliderType) {
            chips.push({
                label: this.translate.instant(filter.gliderType === '1' ? 'glider.tandem' : 'glider.solo'),
                clear: () => this.flightStore.updateFilter({ gliderType: '' })
            });
        }

        if (filter.validationState) {
            chips.push({
                label: this.translate.instant(`flight.validationState.${filter.validationState}`),
                clear: () => this.flightStore.updateFilter({ validationState: '' })
            });
        }

        if (filter.description) {
            chips.push({
                label: `"${filter.description}"`,
                clear: () => this.flightStore.updateFilter({ description: '' })
            });
        }

        return chips;
    });

    clearAll() {
        this.flightStore.resetFilter();
        this.changed.emit();
    }

    /**
     * The filter may hold nothing but an id, so resolve the name from the store
     * rather than render a blank chip.
     */
    private gliderLabel(glider: Glider): string {
        const known = this.gliderStore.gliders()?.find(candidate => candidate.id === glider.id);
        const resolved = known ?? glider;
        return `${resolved.brand ?? ''} ${resolved.name ?? ''}`.trim() || String(glider.id);
    }
}
