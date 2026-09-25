import { Component, Input, computed, inject, signal } from '@angular/core';
import { Chart, ChartConfiguration, ChartData, ChartType, Plugin } from 'chart.js';
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
declare module 'chart.js' {
    interface PluginOptionsByType<TType extends ChartType> {
        barValues?: { enabled: boolean };
    }
}

/** Font size of the printed value, and the gap between it and the bar top. */
const VALUE_SIZE = 8.5;
const VALUE_GAP = 7;

/**
 * Resolved once, the way themeColor caches its tokens: the draw hook runs on
 * every animation frame, and a getComputedStyle there is a forced style flush.
 *
 * An unlaid-out canvas answers '', which would make the shorthand invalid and
 * the assignment a silent no-op - so that answer is neither used nor cached.
 */
let valueFont: string | undefined;

function barValueFont(canvas: HTMLCanvasElement): string {
    if (valueFont !== undefined) {
        return valueFont;
    }
    const family = getComputedStyle(canvas).fontFamily;
    if (!family) {
        return `600 ${VALUE_SIZE}px sans-serif`;
    }
    return valueFont = `600 ${VALUE_SIZE}px ${family}`;
}

const BAR_VALUES: Plugin<'bar'> = {
    id: 'barValues',
    /*
     * Opt-in per chart, and it has to be. ng2-charts registers whatever is
     * passed to [plugins] with Chart.register - globally, not on the one canvas
     * - so without this gate the flight counts were drawn on every Chart.js
     * chart in the app, printing raw unrounded hours over the cumulative
     * airtime line.
     */
    afterDatasetsDraw(chart: Chart<'bar'>, _args: unknown, options: { enabled?: boolean }) {
        if (!options?.enabled) {
            return;
        }
        // By type, not index 0: this chart carries a line dataset alongside the
        // bars, and `order` already means array position proves nothing.
        const index = chart.data.datasets.findIndex(dataset => (dataset.type ?? 'bar') === 'bar');
        if (index < 0) {
            return;
        }
        const values = chart.data.datasets[index].data;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = barValueFont(chart.canvas);
        ctx.fillStyle = themeColor('--fb-text-secondary', '#5b7284');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        chart.getDatasetMeta(index).data.forEach((bar, slot) => {
            const value = Number(values[slot]);
            if (value > 0) {
                ctx.fillText(String(value), bar.x, bar.y - VALUE_GAP);
            }
        });
        ctx.restore();
    }
};

/** Module-level, so the [plugins] binding sees one stable array. */
const CHART_PLUGINS = [BAR_VALUES];

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

    public readonly chartPlugins = CHART_PLUGINS;

    public chartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        /*
         * Headroom for the printed counts, in the pixels they actually occupy.
         * Axis `grace` cannot do this: Chart.js takes the percentage off *half*
         * the data range and then rounds up to the next nice tick, so '30%'
         * bought 15% before rounding and the room left moved with the busiest
         * month - 26px at a peak of 10, 13px at a peak of 5, where the number
         * was clipped by the top of the 78px canvas.
         */
        layout: { padding: { top: VALUE_SIZE + VALUE_GAP } },
        // Axes are hidden: the design labels months in markup underneath.
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true },
            airtime: { display: false, beginAtZero: true, position: 'right' }
        },
        plugins: {
            // This chart is the one that wants the printed counts; the gate is
            // in the plugin, because registration is global.
            barValues: { enabled: true },
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
