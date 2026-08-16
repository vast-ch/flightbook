import { Component, Input, computed, signal } from '@angular/core';
import { Bar } from '../../shared/statistic.store';

/**
 * Flights per season or per month, as plain divs.
 *
 * Deliberately not a chart library: the design draws bare bars with a hairline
 * baseline and a label row, and Chart.js would fight it for a worse result.
 */
@Component({
    selector: 'fb-flights-bars',
    standalone: true,
    template: `
        <div class="bars" [class.bars--tight]="tight()">
            @for (bar of source(); track $index) {
                <div class="bars__slot">
                    <div class="bars__bar" [class.is-empty]="bar.empty" [class.is-peak]="bar.peak"
                         [style.height]="height(bar)"></div>
                </div>
            }
        </div>
        <div class="labels" [class.labels--tight]="tight()">
            @for (bar of source(); track $index) {
                <div class="labels__cell" [class.is-quiet]="bar.empty">{{ bar.label }}</div>
            }
        </div>
    `,
    styleUrls: ['./flights-bars.component.scss']
})
export class FlightsBarsComponent {

    private bars = signal<Bar[]>([]);

    @Input() set data(value: Bar[]) {
        this.bars.set(value ?? []);
    }

    public source = computed(() => this.bars());

    /** A season's worth of years needs a tighter gap than twelve months. */
    public tight = computed(() => this.bars().length > 12);

    /** Empty months stay as a hairline so the axis keeps its rhythm. */
    height(bar: Bar): string {
        return bar.empty ? '2px' : `${Math.max(4, Math.round(bar.ratio * 92))}px`;
    }
}
