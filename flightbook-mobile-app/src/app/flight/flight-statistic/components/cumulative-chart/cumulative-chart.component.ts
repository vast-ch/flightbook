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

    public hasData = computed(() => this.source().length > 1);

    public chartData = computed<ChartData<'line'>>(() => {
        const points = this.source();
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
