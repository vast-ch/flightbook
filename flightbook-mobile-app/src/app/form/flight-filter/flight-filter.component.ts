import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ModalController, IonContent, IonIcon, IonInput, IonButton, IonModal, IonDatetime, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { Subject, Subscription, of } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { catchError, debounceTime, switchMap, takeUntil, tap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { Glider } from 'src/app/glider/shared/glider.model';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { GliderStore } from 'src/app/glider/shared/glider.store';
import { FlightStatistic } from 'src/app/flight/shared/flightStatistic.model';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { search } from 'ionicons/icons';
import moment from 'moment';

/** How many past years the period shorthand offers. */
const YEAR_CHOICES = 2;

type PeriodKey = 'all' | 'last12' | string;

@Component({
    selector: 'app-flight-filter',
    templateUrl: './flight-filter.component.html',
    styleUrls: ['./flight-filter.component.scss'],
    imports: [
        FormsModule,
        DatePipe,
        TranslateModule,
        IonContent,
        IonIcon,
        IonInput,
        IonButton,
        IonModal,
        IonDatetime,
        IonSelect,
        IonSelectOption
    ]
})
export class FlightFilterComponent implements OnInit, OnDestroy {
    public gliders: Glider[] = [];
    private unsubscribe$ = new Subject<void>();
    public language: string;

    /**
     * The sheet edits the store's filter directly - it has no Cancel, and the
     * count on the footer button has to reflect what is actually set, since the
     * statistics endpoint reads the filter from the store.
     */
    public filter = this.flightStore.filter;

    /** null while a count is in flight, so the button can say something neutral. */
    public matchCount = signal<number | null>(null);

    public isFiltered = this.flightStore.filtered;

    /** Offered as period shorthands: all time, this year, last year, 12 months. */
    public readonly years: string[] = Array.from(
        { length: YEAR_CHOICES },
        (_unused, index) => String(new Date().getFullYear() - index)
    );

    /** '' when no glider is filtered on, which is the "all" option's value. */
    public selectedGliderId = computed(() => {
        const id = this.filter().glider?.id;
        return id ? String(id) : '';
    });

    public activePeriod = computed<PeriodKey>(() => {
        const { from, to } = this.filter();
        if (!from && !to) {
            return 'all';
        }
        for (const year of this.years) {
            if (this.isYear(from, to, year)) {
                return year;
            }
        }
        return this.isLast12Months(from, to) ? 'last12' : '';
    });

    /**
     * Created here, not in ngOnInit: toObservable() needs an injection context,
     * and a field initializer is one.
     */
    private filter$ = toObservable(this.filter);

    private countSub?: Subscription;

    constructor(
        private modalCtrl: ModalController,
        private flightStore: FlightStore,
        private gliderStore: GliderStore,
        private translate: TranslateService
    ) {
        this.language = translate.currentLang;
        addIcons({ search });

        if (this.gliderStore.isGliderlistComplete) {
            this.gliders = this.gliderStore.gliders();
        } else {
            this.gliderStore.getGliders({ clearStore: true }).pipe(takeUntil(this.unsubscribe$)).subscribe(() => {
                this.gliderStore.isGliderlistComplete = true;
                this.gliders = this.gliderStore.gliders();
            });
        }
    }

    ngOnInit() {
        // One request per settled change, not per tap - and switchMap, so a
        // slow response for an earlier filter cannot land after a faster one
        // and leave the footer advertising another filter's count.
        this.countSub = this.filter$
            .pipe(
                debounceTime(400),
                tap(() => this.matchCount.set(null)),
                switchMap(() => this.flightStore.getStatistics('global').pipe(
                    catchError(() => of(null))
                )),
                takeUntil(this.unsubscribe$)
            )
            .subscribe((statistics: FlightStatistic[] | null) => {
                this.matchCount.set(statistics ? Number(statistics[0]?.nbFlights ?? 0) : null);
            });
    }

    ngOnDestroy() {
        this.countSub?.unsubscribe();
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    // ---- Period ---------------------------------------------------------

    setPeriod(period: PeriodKey) {
        if (period === 'all') {
            this.flightStore.updateFilter({ from: null, to: null });
            return;
        }
        if (period === 'last12') {
            const from = moment().subtract(12, 'months').toDate();
            this.flightStore.updateFilter({ from, to: moment().toDate() });
            return;
        }
        const year = Number(period);
        this.flightStore.updateFilter({
            from: new Date(year, 0, 1),
            to: new Date(year, 11, 31)
        });
    }

    private isYear(from: Date | null, to: Date | null, year: string): boolean {
        if (!from || !to) {
            return false;
        }
        return moment(from).isSame(moment(`${year}-01-01`), 'day')
            && moment(to).isSame(moment(`${year}-12-31`), 'day');
    }

    private isLast12Months(from: Date | null, to: Date | null): boolean {
        if (!from || !to) {
            return false;
        }
        return moment(from).isSame(moment().subtract(12, 'months'), 'day')
            && moment(to).isSame(moment(), 'day');
    }

    changeDate(type: 'from' | 'to', event: CustomEvent) {
        const value = event.detail.value ? new Date(event.detail.value) : new Date();
        this.flightStore.updateFilter(type === 'from' ? { from: value } : { to: value });
    }

    clearDateButton(type: 'from' | 'to') {
        this.flightStore.updateFilter(type === 'from' ? { from: null } : { to: null });
    }

    // ---- The other criteria ---------------------------------------------

    /**
     * The select trades in id strings, because ion-select matches its options by
     * value and the filter holds a whole Glider - an empty one standing for "any".
     */
    setGliderById(id: string) {
        const glider = id ? this.gliders.find(candidate => String(candidate.id) === id) : null;
        this.flightStore.updateFilter({ glider: glider ?? new Glider() });
    }

    setGliderType(gliderType: string) {
        this.flightStore.updateFilter({ gliderType });
    }

    setValidationState(validationState: string) {
        this.flightStore.updateFilter({ validationState });
    }

    setDescription(description: string) {
        this.flightStore.updateFilter({ description: description ?? '' });
    }

    clearFilter() {
        this.flightStore.resetFilter();
    }

    // ---- Footer ---------------------------------------------------------

    close() {
        return this.modalCtrl.dismiss({ filter: this.filter() }, 'filter');
    }
}
