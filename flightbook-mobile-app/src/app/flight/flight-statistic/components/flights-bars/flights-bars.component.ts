import { Component, Input, computed, inject, signal } from '@angular/core';
import { LanguageService } from 'src/app/shared/services/language.service';
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
        <div class="bars" [class.bars--tight]="tight()" [class.bars--valued]="valued()">
            @for (slot of slots(); track $index) {
                <div class="bars__slot">
                    @if (valued()) {
                        <div class="bars__value">{{ slot.text }}</div>
                    }
                    <div class="bars__bar" [class.is-empty]="slot.bar.empty" [class.is-peak]="slot.bar.peak"
                         [style.height]="height(slot.bar)"></div>
                </div>
            }
        </div>
        <div class="labels" [class.labels--tight]="tight()">
            @for (slot of slots(); track $index) {
                <div class="labels__cell" [class.is-quiet]="slot.bar.empty">{{ slot.bar.label }}</div>
            }
        </div>
    `,
    styleUrls: ['./flights-bars.component.scss']
})
export class FlightsBarsComponent {

    private languageService = inject(LanguageService);

    private bars = signal<Bar[]>([]);

    @Input() set data(value: Bar[]) {
        this.bars.set(value ?? []);
    }

    /**
     * Print each column's number above it. Off by default: a flight count is
     * roughly readable from the bar alone, but an amount of money is not - a
     * chart with no axis leaves the reader nothing to scale against.
     */
    protected valued = signal(false);

    @Input() set showValues(value: boolean) {
        this.valued.set(!!value);
    }

    public source = computed(() => this.bars());

    /** A season's worth of years needs a tighter gap than twelve months. */
    public tight = computed(() => this.bars().length > 12);

    /**
     * Formatted once per data change rather than from the template, which
     * Angular would re-run on every change-detection pass.
     *
     * Empty columns print nothing - a row of zeroes is noise, and the label row
     * already dims them.
     */
    public slots = computed(() => {
        const lang = this.languageService.lang();
        const whole = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
        const tenth = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
        return this.bars().map(bar => ({
            bar,
            text: bar.empty ? '' : this.abbreviate(bar.value, whole, tenth)
        }));
    });

    /**
     * Twelve columns across a phone leave about 28px each, so the number has to
     * stay within roughly four characters.
     *
     * Scaled by hand rather than with Intl's `notation: 'compact'`, which does
     * not abbreviate thousands in German or Italian - CLDR gives those locales
     * a plain pattern below a million, so 12500 came out as "12.500" and
     * overflowed the column on the app's most common language.
     */
    private abbreviate(value: number, whole: Intl.NumberFormat, tenth: Intl.NumberFormat): string {
        // Thresholds compare the rounded value, or 999.6 falls to the last
        // branch and prints "1,000" - wider than the "1k" it should have been.
        const rounded = Math.round(value);
        if (rounded >= 10000) {
            return `${whole.format(value / 1000)}k`;
        }
        if (rounded >= 1000) {
            return `${tenth.format(value / 1000)}k`;
        }
        return whole.format(value);
    }

    /** Empty months stay as a hairline so the axis keeps its rhythm. */
    height(bar: Bar): string {
        return bar.empty ? '2px' : `${Math.max(4, Math.round(bar.ratio * 92))}px`;
    }
}
