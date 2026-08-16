import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { TCreatedPdf } from 'pdfmake/build/pdfmake';
import * as fileSaver from 'file-saver';
import { firstValueFrom } from 'rxjs';
import { Flight } from 'src/app/flight/shared/flight.model';
import { FlightStatistic } from 'src/app/flight/shared/flightStatistic.model';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { AccountService } from 'src/app/account/shared/account.service';
import { SchoolService } from 'src/app/school/shared/school.service';
import { XlsxExportService } from './xlsx-export.service';
import { PdfExportService } from './pdf-export.service';

type SpreadsheetFormat = 'xlsx' | 'csv';

const SPREADSHEET_MIME: Record<SpreadsheetFormat, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv'
};

/**
 * The logbook export picker, shared by the flight list header and the More page
 * so both offer the same formats from one place.
 */
@Injectable({
    providedIn: 'root'
})
export class FlightExportService {
    private flightStore = inject(FlightStore);
    private xlsxExportService = inject(XlsxExportService);
    private pdfExportService = inject(PdfExportService);
    private accountService = inject(AccountService);
    private schoolService = inject(SchoolService);
    private translate = inject(TranslateService);
    private loadingCtrl = inject(LoadingController);
    private alertController = inject(AlertController);
    private actionSheetCtrl = inject(ActionSheetController);

    async openExport() {
        const sheet = await this.actionSheetCtrl.create({
            header: this.translate.instant('buttons.export'),
            buttons: [
                { text: 'XLSX', handler: () => { this.spreadsheetExport('xlsx'); } },
                { text: 'CSV', handler: () => { this.spreadsheetExport('csv'); } },
                { text: 'PDF', handler: () => { this.pdfExport(); } },
                { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
            ]
        });
        await sheet.present();
    }

    async spreadsheetExport(format: SpreadsheetFormat) {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        let flights: Flight[];
        try {
            flights = await firstValueFrom(this.flightStore.getFlights({ store: false }));
        } catch {
            await loading.dismiss();
            return;
        }
        flights = flights.sort((a: Flight, b: Flight) => b.number - a.number);

        if (Capacitor.isNativePlatform()) {
            await this.writeNativeSpreadsheet(flights, format, loading);
            return;
        }

        // CSV comes back as text, XLSX as a byte array, so each gets its own blob.
        if (format === 'csv') {
            const data: string = await this.xlsxExportService.generateFlightsXlsxFile(flights, { bookType: 'csv', type: 'string' });
            await loading.dismiss();
            fileSaver.saveAs(
                new Blob([data], { type: `${SPREADSHEET_MIME.csv};charset=UTF-8` }),
                `flights_export_${Date.now()}.csv`
            );
            return;
        }

        const data: any = await this.xlsxExportService.generateFlightsXlsxFile(flights, { bookType: 'xlsx', type: 'array' });
        await loading.dismiss();
        this.xlsxExportService.saveExcelFile(data, `flights_export_${Date.now()}.xlsx`);
    }

    async pdfExport() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        let flights: Flight[];
        let stat: FlightStatistic;
        try {
            const stats = <FlightStatistic[]>await firstValueFrom(this.flightStore.getStatistics('global'));
            stat = stats[0];
            flights = await firstValueFrom(this.flightStore.getFlights({ store: false }));
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
            const user = await firstValueFrom(this.accountService.currentUser());
            const schools = await this.schoolService.getSchools();
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

    private async writeNativeSpreadsheet(flights: Flight[], format: SpreadsheetFormat, loading: HTMLIonLoadingElement) {
        try {
            // Filesystem takes base64 for binary and plain text for CSV.
            const writeOptions = format === 'csv'
                ? { bookType: 'csv', type: 'string' }
                : { bookType: 'xlsx', type: 'base64' };
            const data: any = await this.xlsxExportService.generateFlightsXlsxFile(flights, writeOptions);

            const result = await Filesystem.writeFile({
                path: `${format}/flights_export.${format}`,
                data,
                directory: Directory.External,
                recursive: true,
                ...(format === 'csv' ? { encoding: Encoding.UTF8 } : {})
            });

            await loading.dismiss();

            try {
                await FileOpener.open({
                    filePath: result.uri,
                    contentType: SPREADSHEET_MIME[format]
                });
            } catch (error) {
                if (Capacitor.getPlatform() == 'android') {
                    await this.alert(this.translate.instant('message.downloadExcel'));
                } else {
                    throw error;
                }
            }
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.generationError'));
        }
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
