import { Component, ViewChild, OnDestroy } from '@angular/core';
import { NavController, LoadingController, AlertController, ActionSheetController, IonIcon, IonContent, IonItem, IonList, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Place } from 'src/app/place/shared/place.model';
import { XlsxExportService } from 'src/app/shared/services/xlsx-export.service';
import { PlaceStore } from '../shared/place.store';
import { Countries, Country } from 'src/app/place/shared/place.countries';
import { json2csv } from 'json-2-csv';
import * as fileSaver from 'file-saver';
import { MapUtil } from 'src/app/shared/util/MapUtil';
import { RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { navigateBackOrTo } from 'src/app/shared/util/back-navigation';
import { FlagsModule } from 'nxt-flags';
import { addIcons } from "ionicons";
import { add, locationOutline, shareOutline, chevronBack, chevronForward } from "ionicons/icons";

@Component({
    selector: 'app-place-list',
    templateUrl: './place-list.page.html',
    styleUrls: ['./place-list.page.scss'],
    imports: [
        RouterLink,
        FlagsModule,
        TranslateModule,
        IonIcon,
        IonContent,
        IonItem,
        IonList,
        IonInfiniteScroll,
        IonInfiniteScrollContent
    ]
})
export class PlaceListPage implements OnDestroy {
    @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;

    unsubscribe$ = new Subject<void>();
    // Use signals directly from the store
    public places = this.placeStore.places;
    public loading = this.placeStore.loading;
    public error = this.placeStore.error;
    limit = 50;
    lang: string;
    countries: Country[] = Countries;

    constructor(
        public navCtrl: NavController,
        private location: Location,
        private alertController: AlertController,
        private actionSheetCtrl: ActionSheetController,
        private placeStore: PlaceStore,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private xlsxExportService: XlsxExportService
    ) {
        this.lang = this.translate.currentLang;
        addIcons({
            add,
            locationOutline,
            shareOutline,
            'chevron-back': chevronBack,
            'chevron-forward': chevronForward,
            'place': 'assets/custom-ion-icons/place.svg'
        });
    }

    ionViewDidEnter() {
        if (this.places().length === 0) {
            this.initialDataLoad();
        }
    }

    private async initialDataLoad() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.placeStore.getPlaces({ limit: this.limit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(async () => {
                await loading.dismiss();
            }, async () => {
                await loading.dismiss();
            });
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    /**
     * More is only the fallback. The list is also reached by saving a place
     * added from the flight form, and a hardcoded navigateBack('more') dropped
     * the pilot on a tab they never came from.
     */
    goBack() {
        navigateBackOrTo(this.navCtrl, this.location, 'more');
    }

    itemTapped(place: Place) {
        this.navCtrl.navigateForward(`places/${place.id}`);
    }

    /** Two formats, so the header button opens a picker rather than doubling up. */
    async openExport() {
        const sheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('buttons.export'),
            buttons: [
                { text: 'XLSX', handler: () => { this.xlsxExport(); } },
                { text: 'CSV', handler: () => { this.csvExport(); } },
                { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
            ]
        });
        await sheet.present();
    }

    loadData(event: any) {
        this.placeStore.getPlaces({ limit: this.limit, offset: this.placeStore.places().length })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((res: Place[]) => {
                event.target.complete();
                if (res.length < this.limit) {
                    event.target.disabled = true;
                }
            });
    }

    getCountryNameByCode(code: string) {
        if (!code) {
            return "";
        }
        // An unknown code used to throw here and take the whole list down with
        // it; fall back to showing the raw code instead.
        const country = this.countries.find(x => x.code === code);
        return country?.name[this.lang] ?? code.toUpperCase();
    }

    async csvExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.placeStore.getPlaces({ store: false }).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Place[]) => {
            res.forEach((val: Place) => {
                delete val['id'];
                val.coordinates = MapUtil.convertEPSG3857ToEPSG4326(val.coordinates)?.flatCoordinates;
            })

            if (Capacitor.isNativePlatform()) {
                try {
                    const data: any = json2csv(res, { emptyFieldValue: '', sortHeader: true });
                    const path = `csv/places_export.csv`;

                    await loading.dismiss();

                    const result = await Filesystem.writeFile({
                        path,
                        data,
                        directory: Directory.External,
                        recursive: true,
                        encoding: Encoding.UTF8
                    });

                    await FileOpener.open({
                        filePath: result.uri,
                        contentType: 'text/plain',
                        openWithDefault: true
                    });

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
                const data: any = json2csv(res, { emptyFieldValue: '', sortHeader: true });
                await loading.dismiss();
                var blob = new Blob([data], {
                    type: "text/csv;charset=utf-8"
                });
                fileSaver.saveAs(blob, `places_export_${Date.now()}.csv`);
            }
        }, async (error: any) => {
            await loading.dismiss();
        });
    }

    async xlsxExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.placeStore.getPlaces({ store: false }).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Place[]) => {
            if (Capacitor.isNativePlatform()) {
                try {
                    const data: any = await this.xlsxExportService.generatePlacesXlsxFile(res, { bookType: 'xlsx', type: 'base64' });
                    const path = `xlsx/places_export.xlsx`;

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
                const data: any = await this.xlsxExportService.generatePlacesXlsxFile(res, { bookType: 'xlsx', type: 'array' });
                await loading.dismiss();
                this.xlsxExportService.saveExcelFile(data, `places`);
            }
        }, async (error: any) => {
            await loading.dismiss();
        });
    }
}
