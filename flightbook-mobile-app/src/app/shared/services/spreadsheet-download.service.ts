import { Injectable, inject } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import * as fileSaver from 'file-saver';
import { XlsxExportService } from './xlsx-export.service';

type SpreadsheetFormat = 'xlsx' | 'csv';

const SPREADSHEET_MIME: Record<SpreadsheetFormat, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv'
};

/**
 * SheetJS writes a BOM for every output type except `string`, which returns the
 * payload without it, so we prepend it ourselves. Without it Excel on Windows
 * decodes the CSV as the system codepage and turns "Zürich" into "ZÃ¼rich".
 */
const UTF8_BOM = '\ufeff';

/**
 * Shared "generate, then save/open" plumbing for every spreadsheet export in
 * the app (flights, gliders, places, passenger confirmations, the combined
 * logbook). Callers only provide a `generate` function producing the raw
 * payload for a given `writeOptions` - platform-specific saving/opening lives
 * here once instead of once per list page.
 */
@Injectable({
    providedIn: 'root'
})
export class SpreadsheetDownloadService {
    private xlsxExportService = inject(XlsxExportService);
    private translate = inject(TranslateService);
    private loadingCtrl = inject(LoadingController);
    private alertController = inject(AlertController);

    async download(params: {
        format: SpreadsheetFormat;
        filenameBase: string;
        generate: (writeOptions: any) => Promise<any>;
    }): Promise<void> {
        const { format, filenameBase, generate } = params;
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        if (Capacitor.isNativePlatform()) {
            await this.downloadNative(format, filenameBase, generate, loading);
            return;
        }

        let data: any;
        try {
            data = await generate(format === 'csv'
                ? { bookType: 'csv', type: 'string' }
                : { bookType: 'xlsx', type: 'array' });
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.generationError'));
            return;
        }

        await loading.dismiss();

        if (format === 'csv') {
            fileSaver.saveAs(
                new Blob([UTF8_BOM + data], { type: `${SPREADSHEET_MIME.csv};charset=UTF-8` }),
                `${filenameBase}_export_${Date.now()}.csv`
            );
            return;
        }

        this.xlsxExportService.saveExcelFile(data, filenameBase);
    }

    private async downloadNative(
        format: SpreadsheetFormat,
        filenameBase: string,
        generate: (writeOptions: any) => Promise<any>,
        loading: HTMLIonLoadingElement
    ): Promise<void> {
        let uri: string;
        try {
            // Filesystem takes base64 for binary and plain text for CSV.
            const writeOptions = format === 'csv'
                ? { bookType: 'csv', type: 'string' }
                : { bookType: 'xlsx', type: 'base64' };
            const generated: any = await generate(writeOptions);
            const data = format === 'csv' ? UTF8_BOM + generated : generated;

            const result = await Filesystem.writeFile({
                path: `${format}/${filenameBase}_export.${format}`,
                data,
                directory: Directory.External,
                recursive: true,
                ...(format === 'csv' ? { encoding: Encoding.UTF8 } : {})
            });
            uri = result.uri;
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.generationError'));
            return;
        }

        await loading.dismiss();

        // Opening is a separate step: the file is already on disk, so a device
        // with no viewer for it must not be reported as a failed export.
        try {
            await FileOpener.open({ filePath: uri, contentType: SPREADSHEET_MIME[format] });
        } catch {
            // Android has no built-in xlsx viewer, so that specific combination
            // gets actionable guidance; every other no-viewer case (csv on any
            // platform, xlsx on iOS) gets the generic "saved, nothing to open it
            // with" message.
            const message = format === 'xlsx' && Capacitor.getPlatform() === 'android'
                ? 'message.downloadExcel'
                : 'message.exportSavedNoViewer';
            await this.alert(this.translate.instant(message));
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
