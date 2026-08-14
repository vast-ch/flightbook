import { Component, OnDestroy, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MenuController, IonContent, IonSkeletonText, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForward, checkmark } from 'ionicons/icons';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SplashScreen } from '@capacitor/splash-screen';
import { NewsStore } from '../news/shared/news.store';
import { AccountService } from '../account/shared/account.service';
import { HomeStore } from './shared/home.store';
import { ActivityChartComponent } from './components/activity-chart/activity-chart.component';

// The splash screen stays up until the first screen is ready to paint.
setTimeout(() => {
    SplashScreen.hide();
}, 700);

@Component({
    selector: 'app-home',
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss'],
    imports: [
        DatePipe,
        TranslateModule,
        ActivityChartComponent,
        IonContent,
        IonSkeletonText,
        IonIcon
    ]
})
export class HomePage implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    private homeStore = inject(HomeStore);
    private newsStore = inject(NewsStore);
    private accountService = inject(AccountService);
    private translate = inject(TranslateService);
    private router = inject(Router);
    private menuCtrl = inject(MenuController);

    public loaded = this.homeStore.loaded;
    public globalStats = this.homeStore.globalStats;
    public monthlyStats = this.homeStore.monthlyStats;
    public nextAppointment = this.homeStore.nextAppointment;
    public trainingProgress = this.homeStore.trainingProgress;
    public licenceProgress = this.homeStore.licenceProgress;
    public controlSheetPercent = this.homeStore.controlSheetPercent;
    public soloFlightDone = this.homeStore.soloFlightDone;

    public latestNews = computed(() => this.newsStore.news()[0] ?? null);

    public initials = computed(() => {
        const user = this.accountService.currentUser$();
        if (!user) {
            return '';
        }
        return `${user.firstname?.charAt(0) ?? ''}${user.lastname?.charAt(0) ?? ''}`.toUpperCase();
    });

    /**
     * Airtime for the headline strip: minutes while under an hour, then hours
     * with one decimal. Returned split so the unit can be styled smaller.
     */
    public airtime = computed(() => {
        const seconds = Number(this.globalStats()?.time ?? 0);
        if (seconds < 3600) {
            return { value: `${Math.round(seconds / 60)}`, unit: 'm' };
        }
        return { value: (seconds / 3600).toFixed(1), unit: 'h' };
    });

    public distance = computed(() => {
        const km = Number(this.globalStats()?.totalDistance ?? 0);
        return { value: km >= 100 ? km.toFixed(0) : km.toFixed(1), unit: 'km' };
    });

    /** Best month and average airtime, derived from the monthly rows. */
    public activitySummary = computed(() => {
        const rows = this.monthlyStats();
        if (rows.length === 0) {
            return null;
        }
        const best = rows.reduce((a, b) => (b.nbFlights > a.nbFlights ? b : a));
        const totalTime = rows.reduce((sum, r) => sum + Number(r.time ?? 0), 0);
        const bestDate = new Date(Number(best.year), Number(best.month) - 1, 1);
        return {
            bestMonthFlights: best.nbFlights,
            bestMonthTime: Number(best.time ?? 0),
            // The design labels this column with the month itself, not a caption.
            bestMonthLabel: bestDate.toLocaleDateString(undefined, { month: 'long' }),
            averageTime: Math.round(totalTime / rows.length)
        };
    });

    constructor() {
        this.menuCtrl.enable(true);
        addIcons({ chevronForward, checkmark });
    }

    /** Seconds to HH:mm - the chart footer format from the design. */
    toHoursMinutes(seconds: number): string {
        const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // ionViewWillEnter, not ngOnInit: Ionic caches pages, so this is what runs
    // again when the user comes back to the tab.
    ionViewWillEnter() {
        if (!this.loaded()) {
            this.homeStore.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
        }

        const news = this.newsStore.news();
        if (news.length === 0 || news[0].language !== this.translate.currentLang) {
            this.newsStore.getNews(this.translate.currentLang).pipe(takeUntil(this.unsubscribe$)).subscribe();
        }
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    openStatistics() {
        this.router.navigate(['flights/statistic']);
    }

    openControlSheet() {
        this.router.navigate(['control-sheet']);
    }

    openAppointment() {
        const next = this.nextAppointment();
        if (next) {
            this.router.navigate(['/school/', next.school.id], { queryParams: { appointmentId: next.appointment.id } });
        }
    }

    openImport() {
        this.router.navigate(['imports/igc']);
    }

    openSettings() {
        this.router.navigate(['settings']);
    }
}
