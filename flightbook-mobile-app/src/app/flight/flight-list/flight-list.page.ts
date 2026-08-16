import { Component, OnInit, OnDestroy, ViewChild, Signal, computed, signal } from '@angular/core';
import { NavController, ModalController, LoadingController, AlertController, IonButton, IonContent, IonItem, IonList, IonInfiniteScroll, IonInfiniteScrollContent, IonIcon, IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FlightFilterComponent } from 'src/app/form/flight-filter/flight-filter.component';
import { FilterChipsComponent } from 'src/app/form/flight-filter/filter-chips.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { FlightExportService } from 'src/app/shared/services/flight-export.service';
import { Flight } from '../shared/flight.model';
import { FlightStatistic } from '../shared/flightStatistic.model';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FlagsModule } from 'nxt-flags';
import { addIcons } from "ionicons";
import {
    add,
    filterOutline,
    trash,
    attachOutline,
    cloudUploadOutline,
    shareOutline
} from "ionicons/icons";
import { FlightValidationState } from '../shared/flight-validation-state';
import { FlightStore } from '../shared/flight.store';
import { AvatarButtonComponent } from 'src/app/shared/components/avatar-button/avatar-button.component';
import { LanguageService } from 'src/app/shared/services/language.service';
import { toHoursMinutes } from 'src/app/shared/util/format';

@Component({
    selector: 'app-flight-list',
    templateUrl: './flight-list.page.html',
    styleUrls: ['./flight-list.page.scss'],
    imports: [
        AvatarButtonComponent,
        FlagsModule,
        DatePipe,
        TranslateModule,
        IonContent,
        IonIcon,
        IonItem,
        IonList,
        IonItemOptions,
        IonItemOption,
        IonItemSliding,
        IonInfiniteScroll,
        IonInfiniteScrollContent,
        IonButton,
        FilterChipsComponent
    ]
})
export class FlightListPage implements OnInit, OnDestroy {
    @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;
    @ViewChild(IonContent) content: IonContent;
    unsubscribe$ = new Subject<void>();
    // Use signals directly from the store
    public flights = this.flightStore.flights;
    public loading = this.flightStore.loading;
    public error = this.flightStore.error;

    public FlightValidationState = FlightValidationState;

    /** All-time totals for the header eyebrow, deliberately unfiltered. */
    private totals = signal<FlightStatistic | null>(null);

    /**
     * True once a page comes back short, i.e. everything is loaded. Gates the
     * end-of-list hint so it can't claim "that's your whole logbook" while
     * infinite scroll still has pages to fetch.
     */
    public listComplete = signal(false);

    public totalFlights = computed(() => this.totals()?.nbFlights ?? 0);
    // The API returns `time` as a string of seconds.
    public totalAirtime = computed(() => toHoursMinutes(Number(this.totals()?.time ?? 0)));

    /**
     * Flights grouped by month for the sectioned list. The store already sorts
     * date-DESC, so a single pass preserves order across infinite-scroll
     * appends without re-sorting.
     */
    public groupedFlights = computed(() => {
        const groups: { key: string; date: string; flights: Flight[] }[] = [];
        for (const flight of this.flights()) {
            const key = (flight.date ?? '').substring(0, 7); // YYYY-MM
            const last = groups[groups.length - 1];
            if (last && last.key === key) {
                last.flights.push(flight);
            } else {
                groups.push({ key, date: flight.date, flights: [flight] });
            }
        }
        return groups;
    });

    get filtered(): Signal<boolean> {
        return this.flightStore.filtered;
    }

    /** LanguageService, not translate.currentLang: reactive, and always a locale Angular has data for. */
    get currentLang(): string {
        return this.languageService.lang();
    }

    constructor(
        public navCtrl: NavController,
        private flightStore: FlightStore,
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private flightExportService: FlightExportService,
        private router: Router,
        private languageService: LanguageService
    ) {
        addIcons({
            add,
            filterOutline,
            trash,
            attachOutline,
            cloudUploadOutline,
            shareOutline
        });
    }

    ionViewDidEnter() {
        if (this.flights().length === 0) {
            this.initialDataLoad();
        }
        // Only when there is nothing to show or the logbook has moved: this
        // used to cost a round-trip on every single visit to the tab, to redraw
        // a header eyebrow that almost never changes.
        if (this.totals() === null || this.totalsRevision !== this.flightStore.revision()) {
            this.loadTotals();
        }
    }

    private async initialDataLoad() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        if (window.innerHeight > 1024) {
            this.flightStore.defaultLimit += Math.ceil((window.innerHeight - 1024) / 47) + 2;
        }

        this.flightStore.getFlights({ limit: this.flightStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: async (res: Flight[]) => {
                    this.listComplete.set(res.length < this.flightStore.defaultLimit);
                    await loading.dismiss();
                },
                error: async () => {
                    await loading.dismiss();
                }
            });
    }

    /** FlightStore.revision the header totals were fetched at. */
    private totalsRevision = -1;

    /** applyFilter: false - the header always reports all-time totals. */
    private loadTotals() {
        const revision = this.flightStore.revision();
        this.flightStore.getStatistics('global', false)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: (res: FlightStatistic[]) => {
                    this.totals.set(res?.[0] ?? null);
                    this.totalsRevision = revision;
                },
                error: () => { /* header totals are non-critical */ }
            });
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    loadData(event: any) {
        this.flightStore.getFlights({ 
            limit: this.flightStore.defaultLimit, 
            offset: this.flights().length 
        })
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe({
            next: (res: Flight[]) => {
                event.target.complete();
                if (res.length < this.flightStore.defaultLimit) {
                    event.target.disabled = true;
                    this.listComplete.set(true);
                }
            },
            error: () => {
                event.target.complete();
            }
        });
    }

    itemTapped(event: MouseEvent, flight: Flight) {
        this.navCtrl.navigateForward(`flights/${flight.id}`);
    }

    async deleteItem(flight: Flight){
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.deleteflight')
        });
        await loading.present();

        this.flightStore.deleteFlight(flight).pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: async () => {
                await loading.dismiss();
            },
            error: async (resp: any) => {
                await loading.dismiss();
            }
        });
    }

    async openFilter() {
        const modal = await this.modalCtrl.create({
            component: FlightFilterComponent,
            cssClass: 'flight-filter-class'
        });

        await modal.present();
        // The sheet only edits the filter now; reloading is the host's job.
        await modal.onWillDismiss();
        this.reloadForFilter();
    }

    /** Also the handler for a chip cleared from the summary row. */
    reloadForFilter() {
        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = false;
        }
        this.flightStore.getFlights({ limit: this.flightStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$)).subscribe();
    }

    clearFilter() {
        this.flightStore.resetFilter();
        this.reloadForFilter();
    }

    openImport() {
        this.router.navigate(['imports/igc']);
    }

    /** Export lives in the header now, so it needs its own picker. */
    openExport() {
        this.flightExportService.openExport();
    }

}
