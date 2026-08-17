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
import { BASE_PAGE_SIZE, FlightStore } from '../shared/flight.store';
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
        // The revision check, not just an empty list: the filter is shared with
        // the Statistics tab, so it can move while this page is off-screen.
        // Without it the rows stayed unfiltered under a filter chip that said
        // otherwise, and the next infinite-scroll page - fetched *with* the
        // filter, at the unfiltered offset - appended flights already on screen,
        // which duplicates `track flight.id` and throws NG0955.
        if (this.flights().length === 0 || this.listRevision !== this.flightStore.revision()) {
            this.initialDataLoad();
        }
        // Only when there is nothing to show or the logbook has moved: this
        // used to cost a round-trip on every single visit to the tab, to redraw
        // a header eyebrow that almost never changes.
        // dataRevision, not revision: these totals are fetched applyFilter: false,
        // so a filter change cannot alter them and must not cost a round-trip.
        if (this.totals() === null || this.totalsRevision !== this.flightStore.dataRevision()) {
            this.loadTotals();
        }
    }

    private async initialDataLoad() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        // Derived from the base size, never added to it. `defaultLimit` is a
        // mutable field on a root-provided store and this method now runs on
        // every filter change, so `+=` grew the page size without bound - and
        // the store's own refetches after add/edit/delete grew with it.
        this.flightStore.defaultLimit = window.innerHeight > 1024
            ? BASE_PAGE_SIZE + Math.ceil((window.innerHeight - 1024) / 47) + 2
            : BASE_PAGE_SIZE;

        const revision = this.flightStore.revision();
        this.flightStore.getFlights({ limit: this.flightStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: async (res: Flight[]) => {
                    this.listComplete.set(res.length < this.flightStore.defaultLimit);
                    this.listRevision = revision;
                    await loading.dismiss();
                },
                error: async () => {
                    await loading.dismiss();
                }
            });
    }

    /** FlightStore.revision the rows on screen were fetched at. */
    private listRevision = -1;

    /** FlightStore.dataRevision the header totals were fetched at. */
    private totalsRevision = -1;

    /** applyFilter: false - the header always reports all-time totals. */
    private loadTotals() {
        const revision = this.flightStore.dataRevision();
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
                // deleteFlight refetches a single page with clearStore, so the
                // list is back to page one: re-arm the scroller and re-answer
                // the end-of-list footnote, or the rest of a long logbook stays
                // unreachable under a note saying it is all there.
                this.listComplete.set(this.flights().length < this.flightStore.defaultLimit);
                this.listRevision = this.flightStore.revision();
                if (this.infiniteScroll) {
                    this.infiniteScroll.disabled = false;
                }
                // The eyebrow counts every flight, so a delete changes it - and
                // loadTotals is otherwise only reachable from ionViewDidEnter,
                // which leaves the old count on screen until the tab is revisited.
                this.loadTotals();
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

        const revision = this.flightStore.revision();
        await modal.present();
        // The sheet only edits the filter now; reloading is the host's job -
        // and only if the sheet actually changed something, since opening and
        // closing it untouched used to cost a full page fetch.
        await modal.onWillDismiss();
        if (this.flightStore.revision() !== revision) {
            this.reloadForFilter();
        }
    }

    /** Also the handler for a chip cleared from the summary row. */
    reloadForFilter() {
        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = false;
        }
        const revision = this.flightStore.revision();
        this.flightStore.getFlights({ limit: this.flightStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                // listComplete has to be re-answered for the new result set, or
                // the end-of-list footnote keeps the previous filter's verdict.
                next: (res: Flight[]) => {
                    this.listComplete.set(res.length < this.flightStore.defaultLimit);
                    this.listRevision = revision;
                }
            });
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
