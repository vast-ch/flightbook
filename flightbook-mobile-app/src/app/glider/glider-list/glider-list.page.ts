import { Component, OnDestroy, ViewChild, Signal } from '@angular/core';
import { NavController, ModalController, LoadingController, ActionSheetController, IonIcon, IonContent, IonItem, IonList, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { GliderFilterComponent } from '../glider-filter/glider-filter.component';
import { GliderFilterChipsComponent } from '../glider-filter/glider-filter-chips.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { XlsxExportService } from 'src/app/shared/services/xlsx-export.service';
import { SpreadsheetDownloadService } from 'src/app/shared/services/spreadsheet-download.service';
import { Glider } from '../shared/glider.model';
import { GliderStore } from '../shared/glider.store';
import { DatePipe, Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HoursFormatPipe } from '../../shared/pipes/hours-format.pipe';
import { addIcons } from "ionicons";
import { add, filterOutline, peopleOutline, personOutline, shareOutline, chevronBack, chevronForward } from "ionicons/icons";
import { navigateBackOrTo } from 'src/app/shared/util/back-navigation';

@Component({
    selector: 'app-glider-list',
    templateUrl: './glider-list.page.html',
    styleUrls: ['./glider-list.page.scss'],
    imports: [
        RouterLink,
        TranslateModule,
        HoursFormatPipe,
        DatePipe,
        IonIcon,
        IonContent,
        IonItem,
        IonList,
        IonInfiniteScroll,
        IonInfiniteScrollContent,
        GliderFilterChipsComponent
    ]
})
export class GliderListPage implements OnDestroy {
    @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;
    unsubscribe$ = new Subject<void>();
    // Use signals directly from the store
    public gliders = this.gliderStore.gliders;
    public loading = this.gliderStore.loading;
    public error = this.gliderStore.error;

    get filtered(): Signal<boolean> {
        return this.gliderStore.filtered;
    }

    constructor(
        public navCtrl: NavController,
        private location: Location,
        private gliderStore: GliderStore,
        public modalCtrl: ModalController,
        private actionSheetCtrl: ActionSheetController,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private xlsxExportService: XlsxExportService,
        private spreadsheetDownloadService: SpreadsheetDownloadService
    ) {
        addIcons({
            'add': add,
            'filter-outline': filterOutline,
            'person-outline': personOutline,
            'people-outline': peopleOutline,
            'share-outline': shareOutline,
            'chevron-back': chevronBack,
            'chevron-forward': chevronForward
        });
    }

    ionViewDidEnter() {
        if (this.gliders().length === 0) {
            this.initialDataLoad();
        }
    }

    private async initialDataLoad() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.gliderStore.getGliders({ limit: this.gliderStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(async () => {
                await loading.dismiss();
            }, async () => {
                await loading.dismiss();
            });
    }

    /**
     * A chip cleared from the summary row. Re-arms the scroller and refetches
     * from page one, the way the filter sheet does on apply - the rows on screen
     * were fetched at the old filter's offsets.
     */
    reloadForFilter() {
        if (this.infiniteScroll) {
            this.infiniteScroll.disabled = false;
        }
        this.gliderStore.getGliders({ limit: this.gliderStore.defaultLimit, clearStore: true })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe();
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    /**
     * More is only the fallback. The list is also reached by saving a glider
     * added from the flight form ("you have no gliders yet"), and a hardcoded
     * navigateBack('more') dropped the pilot on a tab they never came from.
     */
    goBack() {
        navigateBackOrTo(this.navCtrl, this.location, 'more');
    }

    itemTapped(glider: Glider) {
        this.navCtrl.navigateForward(`gliders/${glider.id}`);
    }

    loadData(event: any) {
        this.gliderStore.getGliders({
            limit: this.gliderStore.defaultLimit,
            offset: this.gliders().length
        })
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((res: Glider[]) => {
                event.target.complete();
                if (res.length < this.gliderStore.defaultLimit) {
                    event.target.disabled = true;
                }
            });
    }

    async openFilter() {
        const modal = await this.modalCtrl.create({
            component: GliderFilterComponent,
            componentProps: {
                infiniteScroll: this.infiniteScroll
            }
        });

        return await modal.present();
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

    async xlsxExport() {
        await this.spreadsheetDownloadService.download({
            format: 'xlsx',
            filenameBase: 'gliders',
            generate: async (writeOptions) => {
                const gliders = await firstValueFrom(this.gliderStore.getGliders({ store: false }));
                return this.xlsxExportService.generateGlidersXlsxFile(gliders, writeOptions);
            }
        });
    }

    async csvExport() {
        await this.spreadsheetDownloadService.download({
            format: 'csv',
            filenameBase: 'gliders',
            generate: async (writeOptions) => {
                const gliders = await firstValueFrom(this.gliderStore.getGliders({ store: false }));
                return this.xlsxExportService.generateGlidersXlsxFile(gliders, writeOptions);
            }
        });
    }
}
