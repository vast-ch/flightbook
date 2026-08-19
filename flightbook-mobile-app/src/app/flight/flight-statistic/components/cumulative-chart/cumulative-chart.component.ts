import { Component, Input, computed, signal } from '@angular/core';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { CumulativePoint } from '../../shared/statistic.store';
import { themeColor, withAlpha } from 'src/app/shared/util/theme-color';

/**
 * Cumulative airtime as a filled line on the inverted card.
 *
 * Same recipe as the home activity chart - axes hidden, labels rendered as
 * HTML by the host - deliberately not the old zoom/datalabels chart.
 */
@Component({
    selector: 'fb-cumulative-chart',
    templateUrl: './cumulative-chart.component.html',
    styleUrls: ['./cumulative-chart.component.scss'],
    imports: [NgChartsModule]
})
export class CumulativeChartComponent {

    private source = signal<CumulativePoint[]>([]);

    @Input() set points(value: CumulativePoint[]) {
        this.source.set(value ?? []);
    }

    /** True while the line is one season's, which the design draws white. */
    @Input() set highlighted(value: boolean) {
        this.highlight.set(!!value);
    }

    private highlight = signal(false);

    public hasData = computed(() => this.source().length > 1);

    public chartData = computed<ChartData<'line'>>(() => {
        const points = this.source();
        /*
         * The line is one colour throughout: a season is drawn on its own, so
         * every point belongs to it, and the design paints the selected season
         * white against the all-time line's blue. It used to be a per-segment
         * callback, from when the season was a stretch of the whole run.
         */
        const highlighted = this.highlight();
        const line = highlighted
            ? themeColor('--fb-inverse-text', '#ffffff')
            : themeColor('--fb-accent', '#45b1fd');
        return {
            labels: points.map(p => p.label),
            datasets: [
                {
                    data: points.map(p => p.seconds / 3600),
                    borderColor: line,
                    borderWidth: highlighted ? 3.4 : 2.6,
                    // The wash goes with the line: a white stroke over the
                    // all-time blue read as two series in one chart.
                    backgroundColor: withAlpha(line, highlighted ? 0.16 : 0.22),
                    fill: 'origin',
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0
                }
            ]
        };
    });

    public chartOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        /*
         * Chart.js defaults to hitting a point only where the touch intersects
         * it, and every point here has radius 0 - so the tooltip was reachable
         * within about a pixel, which on a phone is not at all. Index mode
         * takes the nearest month on the x axis instead.
         */
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true }
        },
        plugins: {
            // chartjs-plugin-datalabels is no longer loaded, so there is
            // nothing to switch off here.
            legend: { display: false },
            tooltip: {
                backgroundColor: themeColor('--fb-surface', '#ffffff'),
                titleColor: themeColor('--fb-text', '#10293c'),
                bodyColor: themeColor('--fb-text-body', '#37556b'),
                displayColors: false,
                padding: 8,
                callbacks: {
                    label: (context) => {
                        const hours = context.parsed.y ?? 0;
                        // Round once, to whole minutes: flooring the hours and
                        // rounding the remainder separately printed "100:60 h"
                        // whenever the fraction landed above 59.5/60.
                        const totalMinutes = Math.round(hours * 60);
                        const h = Math.floor(totalMinutes / 60);
                        const m = totalMinutes % 60;
                        return `${h}:${m.toString().padStart(2, '0')} h`;
                    }
                }
            }
        }
    };
}
