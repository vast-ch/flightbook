import { Component, OnInit, OnDestroy, ViewChild, Signal, computed, signal } from '@angular/core';
import { NavController, ModalController, LoadingController, AlertController, ActionSheetController, IonContent, IonItem, IonList, IonInfiniteScroll, IonInfiniteScrollContent, IonIcon, IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/angular/standalone';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FlightFilterComponent } from 'src/app/form/flight-filter/flight-filter.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { XlsxExportService } from '../../shared/services/xlsx-export.service';
import { PdfExportService } from 'src/app/shared/services/pdf-export.service';
import { Flight } from '../shared/flight.model';
import { AccountService } from 'src/app/account/shared/account.service';
import { FlightStatistic } from '../shared/flightStatistic.model';
import { SchoolService } from 'src/app/school/shared/school.service';
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
import { PaymentService } from 'src/app/shared/services/payment.service';
import { FlightValidationState } from '../shared/flight-validation-state';
import { FlightStore } from '../shared/flight.store';

@Component({
    selector: 'app-flight-list',
    templateUrl: './flight-list.page.html',
    styleUrls: ['./flight-list.page.scss'],
    imports: [
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
        IonInfiniteScrollContent
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
    public totalAirtime = computed(() => {
        // The API returns `time` as a string of seconds.
        const seconds = Number(this.totals()?.time ?? 0);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    });

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

    get currentLang(): string {
        return this.translate.currentLang;
    }

    constructor(
        public navCtrl: NavController,
        private flightStore: FlightStore,
        private accountService: AccountService,
        private schoolService: SchoolService,
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private xlsxExportService: XlsxExportService,
        private pdfExportService: PdfExportService,
        private paymentService: PaymentService,
        private actionSheetCtrl: ActionSheetController,
        private router: Router
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
        this.loadTotals();
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

    /** applyFilter: false - the header always reports all-time totals. */
    private loadTotals() {
        this.flightStore.getStatistics('global', false)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: (res: FlightStatistic[]) => this.totals.set(res?.[0] ?? null),
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
            cssClass: 'flight-filter-class',
            componentProps: {
                infiniteScroll: this.infiniteScroll,
                type: 'FlightListPage'
            }
        });

        return await modal.present();
    }

    openImport() {
        this.router.navigate(['imports/igc']);
    }

    /** Export lives in the header now, so it needs its own picker. */
    async openExport() {
        const sheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('buttons.export'),
            buttons: [
                { text: 'XLSX', handler: () => { this.xlsxExport(); } },
                { text: 'PDF', handler: () => { this.pdfExport(); } },
                { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
            ]
        });
        await sheet.present();
    }

    async xlsxExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.flightStore.getFlights({ store: false }).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Flight[]) => {
            res = res.sort((a: Flight, b: Flight) => b.number - a.number);
            if (Capacitor.isNativePlatform()) {
                try {
                    const data: any = await this.xlsxExportService.generateFlightsXlsxFile(res, { bookType: 'xlsx', type: 'base64' });
                    const path = `xlsx/flights_export.xlsx`;

                    const result = await Filesystem.writeFile({
                        path,
                        data,
                        directory: Directory.External,
                        recursive: true
                    });

                    await loading.dismiss();

                    try {
                        await FileOpener.open({
                            filePath: result.uri,
                            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        });
                    } catch (error) {
                        if (Capacitor.getPlatform() == "android") {
                            const alert = await this.alertController.create({
                                header: this.translate.instant('message.infotitle'),
                                message: this.translate.instant('message.downloadExcel'),
                                buttons: [this.translate.instant('buttons.done')]
                            });
                            await alert.present();
                        } else {
                            throw error;
                        }
                    }
                } catch (e) {
                    await loading.dismiss();
                    const alert = await this.alertController.create({
                        header: this.translate.instant('message.infotitle'),
                        message: this.translate.instant('message.generationError'),
                        buttons: [this.translate.instant('buttons.done')]
                    });
                    await alert.present();
                }
            } else {
                const data: any = await this.xlsxExportService.generateFlightsXlsxFile(res, { bookType: 'xlsx', type: 'array' });
                await loading.dismiss();
                this.xlsxExportService.saveExcelFile(data, `flights_export_${Date.now()}.xlsx`);
            }
        }, async (error: any) => {
            await loading.dismiss();
        });
    }

    async pdfExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        const res = <FlightStatistic[]>await firstValueFrom(this.flightStore.getStatistics("global"));
        const stat = res[0];
        this.flightStore.getFlights({ store: false }).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Flight[]) => {
            res = res.sort((a: Flight, b: Flight) => b.number - a.number);
            res.reverse();
            const user = await firstValueFrom(this.accountService.currentUser());
            const schools = await this.schoolService.getSchools();
            const pdfObj: TCreatedPdf = await this.pdfExportService.generatePdf(res, stat, user, schools.length !== 0, 'https://m.flightbook.ch');
            if (Capacitor.isNativePlatform()) {
                pdfObj.getBase64(async (data) => {
                    try {
                        const path = `pdf/flightbook.pdf`;

                        const result = await Filesystem.writeFile({
                            path,
                            data,
                            directory: Directory.External,
                            recursive: true
                        });
                        await loading.dismiss();
                        await FileOpener.open({
                            filePath: result.uri,
                            contentType: 'application/pdf'
                        });
                    } catch (e) {
                        loading.dismiss();
                        const alert = await this.alertController.create({
                            header: this.translate.instant('message.infotitle'),
                            message: e,
                            buttons: [this.translate.instant('buttons.done')]
                        });
                        await alert.present();
                    }
                });
            } else {
                await loading.dismiss();
                pdfObj.download(`flightbook_${Date.now()}.pdf`);
            }
        }, async (error: any) => {
            await loading.dismiss();
        });
    }

    async openAddFlight() {
        if (!this.paymentService.getPaymentStatusValue()?.active && this.flightStore.flights().length >= 25) {
          const alert = await this.alertController.create({
                      header: this.translate.instant('message.infotitle'),
                      message: this.translate.instant('payment.premiumUpgradeRequired'),
                      buttons: [{
                          text: this.translate.instant('buttons.done'),
                      }]
                  });
                  await alert.present();
          return;
        }
        this.router.navigate([`flights/add`]);
      }
}
