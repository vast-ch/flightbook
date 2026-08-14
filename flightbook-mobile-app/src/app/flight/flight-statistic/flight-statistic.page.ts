import { Component, OnDestroy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MenuController, IonContent, IonSkeletonText } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ALL_TIME, StatisticPeriod, StatisticStore } from './shared/statistic.store';
import { ActivityHeatmapComponent } from './components/activity-heatmap/activity-heatmap.component';
import { CumulativeChartComponent } from './components/cumulative-chart/cumulative-chart.component';

@Component({
    selector: 'app-flight-statistic',
    templateUrl: './flight-statistic.page.html',
    styleUrls: ['./flight-statistic.page.scss'],
    imports: [
        DatePipe,
        DecimalPipe,
        TranslateModule,
        ActivityHeatmapComponent,
        CumulativeChartComponent,
        IonContent,
        IonSkeletonText
    ]
})
export class FlightStatisticPage implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    private store = inject(StatisticStore);
    private translate = inject(TranslateService);
    private router = inject(Router);
    private menuCtrl = inject(MenuController);

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
        this.menuCtrl.enable(true);
    }

    ionViewWillEnter() {
        // Loaded once per session: everything below is derived, so switching
        // period costs no requests.
        if (!this.loaded()) {
            this.store.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
        }
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
