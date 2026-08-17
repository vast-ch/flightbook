import { Component, OnDestroy, ViewChild, Signal } from '@angular/core';
import { NavController, ModalController, LoadingController, AlertController, IonIcon, IonContent, IonItem, IonList, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { GliderFilterComponent } from '../glider-filter/glider-filter.component';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { XlsxExportService } from 'src/app/shared/services/xlsx-export.service';
import { Glider } from '../shared/glider.model';
import { GliderStore } from '../shared/glider.store';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HoursFormatPipe } from '../../shared/pipes/hours-format.pipe';
import { addIcons } from "ionicons";
import { add, filterOutline, peopleOutline, personOutline, shareOutline, chevronBack, chevronForward } from "ionicons/icons";

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
        IonInfiniteScrollContent
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
        private gliderStore: GliderStore,
        public modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private loadingCtrl: LoadingController,
        private xlsxExportService: XlsxExportService
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

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    /** Gliders hang off the More page, so that is where back leads. */
    goBack() {
        this.navCtrl.navigateBack('more');
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
                    this.gliderStore.isGliderlistComplete = true;
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

    async xlsxExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        loading.present();
        this.gliderStore.getGliders({ store: false }).pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: Glider[]) => {
            if (Capacitor.isNativePlatform()) {
                try {
                    const data: any = await this.xlsxExportService.generateGlidersXlsxFile(res, { bookType: 'xlsx', type: 'base64' });
                    const path = `xlsx/gliders_export.xlsx`;

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
                const data: any = await this.xlsxExportService.generateGlidersXlsxFile(res, { bookType: 'xlsx', type: 'array' });
                await loading.dismiss();
                this.xlsxExportService.saveExcelFile(data, `gliders_export_${Date.now()}.xlsx`);
            }
        }, async () => {
            await loading.dismiss();
        });
    }
}
