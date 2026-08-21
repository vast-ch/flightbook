import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import moment from 'moment';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { LanguageService } from 'src/app/shared/services/language.service';
import { GliderStore } from 'src/app/glider/shared/glider.store';
import { Glider } from 'src/app/glider/shared/glider.model';

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
    template: `
        @if (chips().length > 0) {
            <div class="fb-chip-row filter-summary">
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
    // .filter-summary* moved to tokens.scss when the glider list grew the same
    // row: two components draw it now, and neither owns the pattern.
})
export class FilterChipsComponent {
    private flightStore = inject(FlightStore);
    private gliderStore = inject(GliderStore);
    private translate = inject(TranslateService);
    private languageService = inject(LanguageService);
    private datePipe = new DatePipe('en-US');

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
                label: this.periodLabel(filter.from, filter.to),
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

    /** A whole calendar year reads as the year; anything else as its range. */
    private periodLabel(from: Date | null, to: Date | null): string {
        if (from && to) {
            const start = moment(from);
            const end = moment(to);
            if (start.isSame(start.clone().startOf('year'), 'day')
                && end.isSame(end.clone().endOf('year'), 'day')
                && start.year() === end.year()) {
                return String(start.year());
            }
            return `${this.short(from)} – ${this.short(to)}`;
        }
        const label = from ? 'filter.from' : 'filter.to';
        return `${this.translate.instant(label)} ${this.short(from ?? to)}`;
    }

    private short(date: Date | null): string {
        return date ? this.datePipe.transform(date, 'dd.MM.yyyy') ?? '' : '';
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
