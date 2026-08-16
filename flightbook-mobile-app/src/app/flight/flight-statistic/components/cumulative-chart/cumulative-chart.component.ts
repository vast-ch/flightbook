import { Component, Input, computed, signal } from '@angular/core';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { CumulativePoint } from '../../shared/statistic.store';

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

    /** The season to pick out of the line, or null for the whole run. */
    @Input() set highlightYear(value: string | null) {
        this.highlight.set(value);
    }

    private highlight = signal<string | null>(null);

    public hasData = computed(() => this.source().length > 1);

    public chartData = computed<ChartData<'line'>>(() => {
        const points = this.source();
        /*
         * Read here, in the computed's own body. The segment callbacks below are
         * invoked by Chart.js at paint time, outside the reactive graph, so a
         * signal read inside them registers no dependency - the computed kept
         * returning its cached object and ng2-charts never saw a new `data`
         * reference, leaving the highlight stuck on the previous season.
         */
        const year = this.highlight();
        const isHighlighted = (index: number) => !!year && points[index]?.year === year;
        return {
            labels: points.map(p => p.label),
            datasets: [
                {
                    data: points.map(p => p.seconds / 3600),
                    borderColor: '#45b1fd',
                    borderWidth: 2.6,
                    backgroundColor: 'rgba(69, 177, 253, 0.22)',
                    fill: 'origin',
                    tension: 0,
                    pointRadius: 0,
                    /*
                     * A segment callback rather than a second dataset: the
                     * design paints the selected season's stretch white, and
                     * Chart.js can colour per segment without duplicating the
                     * series or its fill.
                     */
                    segment: {
                        borderColor: ctx => isHighlighted(ctx.p1DataIndex) ? '#ffffff' : '#45b1fd',
                        borderWidth: ctx => isHighlighted(ctx.p1DataIndex) ? 3.4 : 2.6
                    },
                    // Mark only where the line ends.
                    pointHoverRadius: 4
                }
            ]
        };
    });

    public chartOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true }
        },
        plugins: {
            // chartjs-plugin-datalabels is no longer loaded, so there is
            // nothing to switch off here.
            legend: { display: false },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#10293c',
                bodyColor: '#37556b',
                displayColors: false,
                padding: 8,
                callbacks: {
                    label: (context) => {
                        const hours = context.parsed.y ?? 0;
                        const h = Math.floor(hours);
                        const m = Math.round((hours - h) * 60);
                        return `${h}:${m.toString().padStart(2, '0')} h`;
                    }
                }
            }
        }
    };
}
