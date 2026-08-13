import { Component, Input, computed, signal } from '@angular/core';
import { ChartConfiguration, ChartData } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { FlightStatistic } from '../../../flight/shared/flightStatistic.model';

const MONTHS_SHOWN = 12;

export interface MonthColumn {
    /** Single-letter month initial shown under the chart. */
    initial: string;
    /** Months that actually contain flights are emphasised. */
    active: boolean;
}

/**
 * Compact "flights per month" summary for the dashboard: bars for the flight
 * count, a line for airtime. Deliberately not the statistics page chart - that
 * one carries zoom, data labels and a fixed 15-column window.
 */
@Component({
    selector: 'fb-activity-chart',
    templateUrl: './activity-chart.component.html',
    styleUrls: ['./activity-chart.component.scss'],
    imports: [NgChartsModule]
})
export class ActivityChartComponent {

    private monthly = signal<FlightStatistic[]>([]);

    @Input() set statistics(value: FlightStatistic[]) {
        this.monthly.set(value ?? []);
    }

    /** Trailing 12 months, oldest first, gaps filled with zeroes. */
    private series = computed(() => {
        const rows = this.monthly();
        const byKey = new Map<string, FlightStatistic>();
        for (const row of rows) {
            byKey.set(`${row.year}-${Number(row.month)}`, row);
        }

        const now = new Date();
        const out: { label: string; initial: string; nbFlights: number; hours: number }[] = [];

        for (let i = MONTHS_SHOWN - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const row = byKey.get(`${d.getFullYear()}-${d.getMonth() + 1}`);
            out.push({
                label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
                initial: d.toLocaleDateString(undefined, { month: 'narrow' }),
                nbFlights: row?.nbFlights ?? 0,
                hours: row ? Number(row.time ?? 0) / 3600 : 0
            });
        }
        return out;
    });

    public columns = computed<MonthColumn[]>(() =>
        this.series().map(m => ({ initial: m.initial, active: m.nbFlights > 0 }))
    );

    public hasData = computed(() => this.series().some(m => m.nbFlights > 0));

    public chartData = computed<ChartData<'bar'>>(() => {
        const series = this.series();
        const peak = Math.max(...series.map(m => m.nbFlights), 0);

        return {
            labels: series.map(m => m.label),
            datasets: [
                {
                    type: 'bar',
                    label: 'flights',
                    data: series.map(m => m.nbFlights),
                    // The busiest months get the solid accent, quieter ones a tint.
                    backgroundColor: series.map(m =>
                        m.nbFlights === 0 ? '#e1ecf4' : (m.nbFlights >= peak ? '#45b1fd' : '#a7dafe')
                    ),
                    borderRadius: 2,
                    barPercentage: 0.72,
                    categoryPercentage: 0.86,
                    order: 2
                },
                {
                    type: 'line' as const,
                    label: 'airtime',
                    data: series.map(m => m.hours),
                    borderColor: '#10293c',
                    borderWidth: 1.6,
                    pointRadius: series.map(m => (m.hours > 0 ? 3 : 0)),
                    pointBackgroundColor: '#10293c',
                    tension: 0,
                    yAxisID: 'airtime',
                    order: 1
                } as any
            ]
        };
    });

    public chartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        // Axes are hidden: the design labels months in markup underneath.
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true },
            airtime: { display: false, beginAtZero: true, position: 'right' }
        },
        plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: {
                backgroundColor: '#10293c',
                padding: 8,
                displayColors: false,
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y ?? 0;
                        return context.dataset.label === 'airtime'
                            ? `${value.toFixed(1)} h`
                            : `${value} ×`;
                    }
                }
            }
        }
    };
}
