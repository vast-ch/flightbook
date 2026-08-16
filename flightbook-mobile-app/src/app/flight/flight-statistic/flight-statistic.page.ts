import { Component, OnDestroy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { IonButton, IonContent, IonIcon, IonSkeletonText } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ALL_TIME, StatisticPeriod, StatisticStore } from './shared/statistic.store';
import { ActivityHeatmapComponent } from './components/activity-heatmap/activity-heatmap.component';
import { FlightsBarsComponent } from './components/flights-bars/flights-bars.component';
import { SeasonGridComponent } from './components/season-grid/season-grid.component';
import { CumulativeChartComponent } from './components/cumulative-chart/cumulative-chart.component';
import { FlightFilterComponent } from 'src/app/form/flight-filter/flight-filter.component';
import { FilterChipsComponent } from 'src/app/form/flight-filter/filter-chips.component';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForward, filterOutline, trendingUp } from 'ionicons/icons';
import { AvatarButtonComponent } from 'src/app/shared/components/avatar-button/avatar-button.component';

@Component({
    selector: 'app-flight-statistic',
    templateUrl: './flight-statistic.page.html',
    styleUrls: ['./flight-statistic.page.scss'],
    imports: [
        AvatarButtonComponent,
        DatePipe,
        DecimalPipe,
        TranslateModule,
        ActivityHeatmapComponent,
        FlightsBarsComponent,
        SeasonGridComponent,
        CumulativeChartComponent,
        IonButton,
        IonContent,
        IonIcon,
        IonSkeletonText,
        FilterChipsComponent
    ]
})
export class FlightStatisticPage implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    private store = inject(StatisticStore);
    private translate = inject(TranslateService);
    private router = inject(Router);
    private modalCtrl = inject(ModalController);
    private flightStore = inject(FlightStore);

    public filtered = this.flightStore.filtered;

    public readonly ALL_TIME = ALL_TIME;

    public loaded = this.store.loaded;
    public hasFlights = this.store.hasFlights;
    public period = this.store.period;
    public years = this.store.years;
    public headline = this.store.headline;
    public heatmap = this.store.heatmap;
    public flyingDays = this.store.flyingDays;
    public weekCount = this.store.weekCount;
    public cumulative = this.store.cumulative;
    public bests = this.store.bests;
    public firstFlightDate = this.store.firstFlightDate;

    /** Total airtime for the selected period, as HH:mm. */
    public totalAirtime = computed(() => this.toHoursMinutes(this.headline().airtime));

    /**
     * Airtime and average as value + unit, so the unit can be styled smaller.
     * Minutes below an hour, hours above - matching the home stat strip.
     */
    public airtimeParts = computed(() => this.splitDuration(this.headline().airtime));
    public averageParts = computed(() => this.splitDuration(this.headline().average));

    public distanceParts = computed(() => {
        const km = this.headline().distance;
        return { value: km >= 100 ? km.toFixed(0) : km.toFixed(1), unit: 'km' };
    });

    get currentLang(): string {
        return this.translate.currentLang;
    }

    constructor() {
        addIcons({ filterOutline, trendingUp, 'chevron-forward': chevronForward });
    }

    public seasons = this.store.seasons;
    public seasonGrid = this.store.seasonGrid;
    public bars = this.store.bars;
    public comparison = this.store.comparison;
    public monthInitials = this.store.monthInitials;
    public activeMonths = this.store.activeMonths;

    /** Newest first, the way the design stacks the seasons list. */
    public seasonsNewestFirst = computed(() => [...this.seasons()].reverse());

    public chartMeta = computed(() => {
        const seasons = this.seasons();
        if (this.period() !== ALL_TIME) {
            return this.period();
        }
        return seasons.length > 1
            ? `${seasons[0].year} – ${seasons[seasons.length - 1].year}`
            : (seasons[0]?.year ?? '');
    });

    /** The design's second sentence names a specific year; only the first generalises. */
    public chartNote = computed(() => {
        const peak = this.store.peakLabel();
        if (!peak) {
            return '';
        }
        const key = this.period() === ALL_TIME ? 'statistics.strongestSeason' : 'statistics.busiestMonth';
        return this.translate.instant(key, { name: peak.name, flights: peak.flights, count: peak.flights });
    });

    public comparisonText = computed(() => {
        const compare = this.comparison();
        if (!compare) {
            return '';
        }
        if (compare.delta === null) {
            return this.translate.instant('statistics.compareFirst', { count: compare.flights });
        }
        const delta = compare.delta >= 0 ? `+${compare.delta}` : String(compare.delta);
        const rank = compare.rank === 1
            ? this.translate.instant('statistics.rankBest')
            : this.translate.instant('statistics.rankOrdinal', { rank: compare.rank });
        const head = this.translate.instant('statistics.compare', {
            count: compare.flights,
            delta,
            year: compare.previousYear
        });
        return `${head} · ${rank}`;
    });

    /** Sparkline bars share the season's own busiest month, not a global max. */
    sparkHeight(value: number, months: number[]): string {
        const max = Math.max(...months, 1);
        return value === 0 ? '2px' : `${Math.max(3, Math.round(value / max * 22))}px`;
    }

    ionViewWillEnter() {
        // Loaded once per session: everything below is derived, so switching
        // period costs no requests.
        if (!this.loaded()) {
            this.store.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
        }
    }

    async openFilter() {
        const modal = await this.modalCtrl.create({
            component: FlightFilterComponent,
            cssClass: 'flight-filter-class'
        });
        await modal.present();
        await modal.onWillDismiss();
        this.reloadForFilter();
    }

    /** The store caches per session, so a filter change has to force a refetch. */
    reloadForFilter() {
        this.store.reload().pipe(takeUntil(this.unsubscribe$)).subscribe();
    }

    clearFilter() {
        this.flightStore.resetFilter();
        this.reloadForFilter();
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    selectPeriod(period: StatisticPeriod) {
        this.period.set(period);
    }

    openImport() {
        this.router.navigate(['imports/igc']);
    }

    /** Seconds to HH:mm. */
    toHoursMinutes(seconds: number): string {
        const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    private splitDuration(seconds: number): { value: string; unit: string } {
        const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
        if (total < 3600) {
            return { value: `${Math.round(total / 60)}`, unit: 'min' };
        }
        return { value: (total / 3600).toFixed(1), unit: 'h' };
    }
}
