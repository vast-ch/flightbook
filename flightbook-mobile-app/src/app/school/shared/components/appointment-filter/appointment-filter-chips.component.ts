import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { SchoolService } from '../../school.service';
import { LanguageService } from 'src/app/shared/services/language.service';
import { dateRangeLabel } from 'src/app/shared/util/format';

type Chip = { label: string; clear: () => void };

/**
 * What the appointment filter is narrowing by, one removable chip per criterion -
 * the counterpart to fb-filter-chips on Flights and fb-glider-filter-chips on
 * Gliders. Without it the only sign of a filter was the word "filtered" in the
 * eyebrow, which named nothing and offered no way back but reopening the sheet.
 *
 * Third component of the same shape now. The row itself lives in tokens.scss;
 * only the labels and the clears are specific to this filter.
 */
@Component({
    selector: 'fb-appointment-filter-chips',
    standalone: true,
    imports: [TranslateModule, IonIcon],
    templateUrl: './appointment-filter-chips.component.html'
})
export class AppointmentFilterChipsComponent {
    private schoolService = inject(SchoolService);
    private translate = inject(TranslateService);
    private languageService = inject(LanguageService);

    /** Fires after a criterion is dropped, so the host can refetch. */
    @Output() changed = new EventEmitter<void>();

    constructor() {
        addIcons({ close });
    }

    public chips = computed<Chip[]>(() => {
        const filter = this.schoolService.filter();
        // The labels come from translate.instant(), a plain call - without reading
        // the language signal they keep the previous language after a switch.
        this.languageService.lang();
        const chips: Chip[] = [];

        // One chip for the range: two would let a pilot clear an end and leave a
        // half-open period whose remaining chip reads as the whole filter.
        if (filter.from || filter.to) {
            chips.push({
                label: dateRangeLabel(filter.from, filter.to, key => this.translate.instant(key)),
                clear: () => this.schoolService.updateFilter({ from: null, to: null })
            });
        }

        if (filter.state) {
            chips.push({
                label: this.translate.instant(`appointment.stateValue.${filter.state}`),
                clear: () => this.schoolService.updateFilter({ state: '' })
            });
        }

        return chips;
    });

    clearAll() {
        this.schoolService.resetFilter();
        this.changed.emit();
    }
}
