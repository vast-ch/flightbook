import { Component, Input, computed, signal } from '@angular/core';
import { SeasonRow } from '../../shared/statistic.store';

/**
 * All-time activity as one row per season and one cell per month.
 *
 * This is what lets all-time cover the whole logbook: a day grid over a decade
 * is ~630 columns and collapses to sub-pixel, where twelve columns never do.
 */
@Component({
    selector: 'fb-season-grid',
    standalone: true,
    template: `
        <div class="grid">
            <div class="grid__years">
                @for (row of rows(); track row.year) {
                    <div class="grid__year">{{ row.year }}</div>
                }
            </div>

            <div class="grid__body">
                @for (row of rows(); track row.year) {
                    <div class="grid__row">
                        @for (level of row.cells; track $index) {
                            <div class="grid__cell" [attr.data-level]="level"></div>
                        }
                    </div>
                }
                <div class="grid__months">
                    @for (initial of months; track $index) {
                        <div class="grid__month">{{ initial }}</div>
                    }
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./season-grid.component.scss']
})
export class SeasonGridComponent {

    private source = signal<SeasonRow[]>([]);

    @Input() set seasons(value: SeasonRow[]) {
        this.source.set(value ?? []);
    }

    /** Localised, so the initials are not always J F M A M J J A S O N D. */
    @Input() months: string[] = [];

    public rows = computed(() => this.source());
}
