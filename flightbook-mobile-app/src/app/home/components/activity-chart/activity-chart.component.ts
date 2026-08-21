import { Component, Input, computed, inject, signal } from '@angular/core';
import { Chart, ChartConfiguration, ChartData, Plugin } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { FlightStatistic } from '../../../flight/shared/flightStatistic.model';
import { LanguageService } from '../../../shared/services/language.service';
import { themeColor } from 'src/app/shared/util/theme-color';

const MONTHS_SHOWN = 12;

/**
 * Prints the flight count above each bar.
 *
 * An inline plugin rather than chartjs-plugin-datalabels, which this app does not
 * ship - one number per column does not justify a dependency. Empty months print
 * nothing, matching fb-flights-bars: a row of zeroes is noise, and the month
 * labels underneath already dim them.
 */
/** Font size of the printed value, and the gap between it and the bar top. */
const VALUE_SIZE = 8.5;
const VALUE_GAP = 7;

const BAR_VALUES: Plugin<'bar'> = {
    id: 'barValues',
    afterDatasetsDraw(chart: Chart<'bar'>) {
        const meta = chart.getDatasetMeta(0);
        const values = chart.data.datasets[0]?.data ?? [];
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = `600 ${VALUE_SIZE}px ${getComputedStyle(chart.canvas).fontFamily}`;
        ctx.fillStyle = themeColor('--fb-text-secondary', '#5b7284');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        meta.data.forEach((bar, index) => {
            const value = Number(values[index] ?? 0);
            if (value > 0) {
                ctx.fillText(String(value), bar.x, bar.y - VALUE_GAP);
            }
        });
        ctx.restore();
    }
};


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

    private languageService = inject(LanguageService);

    private monthly = signal<FlightStatistic[]>([]);

    @Input() set statistics(value: FlightStatistic[]) {
        this.monthly.set(value ?? []);
    }

    /** Trailing 12 months, oldest first, gaps filled with zeroes. */
    private series = computed(() => {
        // Read as a signal so the month names re-render on a language switch.
        const lang = this.languageService.lang();
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
                label: d.toLocaleDateString(lang, { month: 'short', year: 'numeric' }),
                initial: d.toLocaleDateString(lang, { month: 'narrow' }),
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
                        m.nbFlights === 0
                            ? themeColor('--fb-track', '#e1ecf4')
                            : (m.nbFlights >= peak
                                ? themeColor('--fb-accent', '#45b1fd')
                                : themeColor('--fb-accent-weak', '#a7dafe'))
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
                    borderColor: themeColor('--fb-text', '#10293c'),
                    borderWidth: 1.6,
                    pointRadius: series.map(m => (m.hours > 0 ? 3 : 0)),
                    pointBackgroundColor: themeColor('--fb-text', '#10293c'),
                    tension: 0,
                    yAxisID: 'airtime',
                    order: 1
                } as any
            ]
        };
    });

    public readonly chartPlugins = [BAR_VALUES];

    public chartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        // Axes are hidden: the design labels months in markup underneath.
        scales: {
            x: { display: false },
            // grace: the printed values sit above the bars, and without headroom
            // the tallest column's number is clipped by the top of the canvas. It
            // has to cover VALUE_GAP plus the glyph height - about 16px of a 78px
            // canvas, so a fifth is not enough once the gap grew to 7.
            y: { display: false, beginAtZero: true, grace: '30%' },
            airtime: { display: false, beginAtZero: true, grace: '30%', position: 'right' }
        },
        plugins: {
            // chartjs-plugin-datalabels is no longer loaded, so there is
            // nothing to switch off here.
            legend: { display: false },
            tooltip: {
                backgroundColor: themeColor('--fb-text', '#10293c'),
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
