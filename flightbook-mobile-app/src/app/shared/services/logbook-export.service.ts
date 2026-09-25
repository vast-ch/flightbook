import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import { firstValueFrom } from 'rxjs';
import { Flight } from 'src/app/flight/shared/flight.model';
import { FlightStatistic } from 'src/app/flight/shared/flightStatistic.model';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { Glider } from 'src/app/glider/shared/glider.model';
import { GliderStore } from 'src/app/glider/shared/glider.store';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from 'src/app/place/shared/place.store';
import { PassengerConfirmation } from 'src/app/tandem/shared/domain/passenger-confirmation.model';
import { TandemService } from 'src/app/tandem/shared/tandem.service';
import { AccountService } from 'src/app/account/shared/account.service';
import { SchoolService } from 'src/app/school/shared/school.service';
import { XlsxExportService } from './xlsx-export.service';
import { PdfExportService } from './pdf-export.service';
import { SpreadsheetDownloadService } from './spreadsheet-download.service';

type SpreadsheetFormat = 'xlsx' | 'csv';

/**
 * The logbook export pickers, shared by the flight list header and the More
 * page. The flight list only ever offers flights (XLSX/CSV) plus the SHV
 * certification PDF; More offers the full logbook (flights + gliders + places
 * + passenger confirmations, XLSX only) plus that same certification PDF.
 */
@Injectable({
    providedIn: 'root'
})
export class LogbookExportService {
    private flightStore = inject(FlightStore);
    private gliderStore = inject(GliderStore);
    private placeStore = inject(PlaceStore);
    private tandemService = inject(TandemService);
    private xlsxExportService = inject(XlsxExportService);
    private pdfExportService = inject(PdfExportService);
    private spreadsheetDownloadService = inject(SpreadsheetDownloadService);
    private accountService = inject(AccountService);
    private schoolService = inject(SchoolService);
    private translate = inject(TranslateService);
    private loadingCtrl = inject(LoadingController);
    private alertController = inject(AlertController);
    private actionSheetCtrl = inject(ActionSheetController);

    /** Flights only - the flight list header's own export button. */
    async openExport() {
        const sheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('buttons.export'),
            buttons: [
                { text: 'XLSX', handler: () => { this.spreadsheetExport('xlsx'); } },
                { text: 'CSV', handler: () => { this.spreadsheetExport('csv'); } },
                { text: this.translate.instant('export.shvCertification'), handler: () => { this.pdfExport(); } },
                { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
            ]
        });
        await sheet.present();
    }

    /** Full logbook - the More page's export row. No CSV: a combined workbook has no single flat shape. */
    async openFullExport() {
        const sheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('buttons.export'),
            buttons: [
                { text: this.translate.instant('export.fullLogbook'), handler: () => { this.fullLogbookXlsxExport(); } },
                { text: this.translate.instant('export.shvCertification'), handler: () => { this.pdfExport(); } },
                { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
            ]
        });
        await sheet.present();
    }

    async spreadsheetExport(format: SpreadsheetFormat) {
        await this.spreadsheetDownloadService.download({
            format,
            filenameBase: 'flights',
            generate: async (writeOptions) => {
                const flights = (await firstValueFrom(this.flightStore.getFlights({ store: false })))
                    .sort((a: Flight, b: Flight) => b.number - a.number);
                return this.xlsxExportService.generateFlightsXlsxFile(flights, writeOptions);
            }
        });
    }

    async fullLogbookXlsxExport() {
        await this.spreadsheetDownloadService.download({
            format: 'xlsx',
            filenameBase: 'logbook',
            generate: async (writeOptions) => {
                const [flights, gliders, places, confirmations]: [Flight[], Glider[], Place[], PassengerConfirmation[]] = await Promise.all([
                    firstValueFrom(this.flightStore.getFlights({ store: false })),
                    firstValueFrom(this.gliderStore.getGliders({ store: false })),
                    firstValueFrom(this.placeStore.getPlaces({ store: false })),
                    firstValueFrom(this.tandemService.getPassengerConfirmations())
                ]);
                flights.sort((a: Flight, b: Flight) => b.number - a.number);
                return this.xlsxExportService.generateFlightbookXlsxFile(flights, gliders, places, confirmations, writeOptions);
            }
        });
    }

    async pdfExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        let flights: Flight[];
        let stat: FlightStatistic;
        try {
            // Neither feeds the other, and the logbook is the unpaginated one -
            // sequential awaits put a whole round trip in front of the download.
            const [stats, logbook] = await Promise.all([
                firstValueFrom(this.flightStore.getStatistics('global')) as Promise<FlightStatistic[]>,
                firstValueFrom(this.flightStore.getFlights({ store: false }))
            ]);
            stat = stats[0];
            flights = logbook;
        } catch {
            await loading.dismiss();
            return;
        }

        flights = flights.sort((a: Flight, b: Flight) => b.number - a.number);
        flights.reverse();

        // Inside the try as well: an expired token or a dropped connection here
        // used to reject out of this method with the blocking spinner still up,
        // leaving an overlay the user could only escape by killing the app.
        let pdfObj: TCreatedPdf;
        try {
            // The signal first: AppComponent populates it once at session
            // bootstrap and every screen reads it for free, so re-GETting /users
            // on each export bought nothing. The request stays as the fallback
            // for an export started before the bootstrap landed.
            const cached = this.accountService.currentUser$();
            const [user, schools] = await Promise.all([
                cached ? Promise.resolve(cached) : firstValueFrom(this.accountService.currentUser()),
                this.schoolService.getSchools()
            ]);
            pdfObj = await this.pdfExportService.generatePdf(flights, stat, user, schools.length !== 0, 'https://m.flightbook.ch');
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.generationError'));
            return;
        }

        if (!Capacitor.isNativePlatform()) {
            await loading.dismiss();
            pdfObj.download(`flightbook_${Date.now()}.pdf`);
            return;
        }

        pdfObj.getBase64(async (data) => {
            try {
                const result = await Filesystem.writeFile({
                    path: 'pdf/flightbook.pdf',
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
                await loading.dismiss();
                await this.alert(e);
            }
        });
    }

    private async alert(message: any) {
        const alert = await this.alertController.create({
            header: this.translate.instant('message.infotitle'),
            message,
            buttons: [this.translate.instant('buttons.done')]
        });
        await alert.present();
    }
}
