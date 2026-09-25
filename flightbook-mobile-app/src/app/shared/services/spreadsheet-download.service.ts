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
 * Where an Android export is offered to, best destination first.
 *
 * Downloads leads because it is the folder Android users actually open: the
 * Files app gives it a top-level entry, while Documents sits behind
 * "Browse -> Internal storage". It is reached through `ExternalStorage`
 * (`/sdcard`) because the plugin has no Downloads member, and the plugin
 * documents that member as unavailable on Android 11+ - true of the `/sdcard`
 * root, but `Download` is a MediaStore collection any app may add to. Rather
 * than bet on which reading is right, we try it and keep Documents - verified
 * working on Android 14 - as the fallback.
 */
const PUBLIC_TARGETS: {
    directory: Directory;
    /** Folder to write into, relative to `directory`. */
    folder: string;
    /** The same place as the user sees it, relative to the storage root the Files app opens on. */
    label: string;
}[] = [
    { directory: Directory.ExternalStorage, folder: 'Download', label: 'Download' },
    { directory: Directory.Documents, folder: 'Flightbook', label: 'Documents/Flightbook' }
];

/**
 * SheetJS writes a BOM for every output type except `string`, which returns the
 * payload without it, so we prepend it ourselves. Without it Excel on Windows
 * decodes the CSV as the system codepage and turns "Zürich" into "ZÃ¼rich".
 */
const UTF8_BOM = '\ufeff';

/** Where a generated export ended up, and how to describe that to the user. */
interface SavedExport {
    /** Absolute file:// uri, for FileOpener. */
    uri: string;
    /** User-facing path, e.g. `Documents/Flightbook/flights_export_….xlsx`. Absent when the file went to the app's private cache, which the user cannot browse. */
    location?: string;
}

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
        const filename = `${filenameBase}_export_${this.timestamp()}.${format}`;
        let saved: SavedExport;
        try {
            // Filesystem takes base64 for binary and plain text for CSV.
            const writeOptions = format === 'csv'
                ? { bookType: 'csv', type: 'string' }
                : { bookType: 'xlsx', type: 'base64' };
            const generated: any = await generate(writeOptions);
            const data = format === 'csv' ? UTF8_BOM + generated : generated;
            saved = await this.save(filename, data, format);
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.generationError'));
            return;
        }

        await loading.dismiss();

        // Opening is a separate step: the file is already saved, so a device
        // with no viewer for it must not be reported as a failed export.
        try {
            await FileOpener.open({ filePath: saved.uri, contentType: SPREADSHEET_MIME[format] });
            return;
        } catch {
            // No ACTION_VIEW handler. Android ships no xlsx viewer at all - it
            // resolves only when Drive/Sheets/Excel happens to be installed -
            // and csv has few handlers anywhere. The export still succeeded:
            // point the user at the file instead of reporting a failure.
        }

        await this.alert(saved.location
            ? this.translate.instant('message.exportSavedTo', { location: saved.location })
            : this.translate.instant('message.exportSavedNoViewer'));
    }

    /**
     * Android exports go to public storage - see `PUBLIC_TARGETS`. The export
     * has to outlive the "can anything open it?" question: the user must be
     * able to find the file afterwards even when no spreadsheet app is
     * installed. `Directory.External` (what this used to do) is
     * `/sdcard/Android/data/<pkg>/files`, which the Files app has refused to
     * browse since Android 11, and the cache is not user storage at all.
     *
     * Public storage is unreachable on Android 10 (scoped storage, with
     * `requestLegacyExternalStorage` inert at targetSdk 30+) and on API <= 28
     * without WRITE_EXTERNAL_STORAGE. A refusal there falls back to the cache,
     * which the user cannot browse - the one case left where the export can
     * only be reported as saved, not located.
     *
     * iOS keeps the cache: FileOpener previews the file in Quick Look, whose
     * own share button already offers "Save to Files".
     */
    private async save(filename: string, data: any, format: SpreadsheetFormat): Promise<SavedExport> {
        const encoding = format === 'csv' ? { encoding: Encoding.UTF8 } : {};

        if (Capacitor.getPlatform() === 'android' && await this.publicStorageGranted()) {
            for (const target of PUBLIC_TARGETS) {
                try {
                    const result = await Filesystem.writeFile({
                        path: `${target.folder}/${filename}`,
                        data,
                        directory: target.directory,
                        recursive: true,
                        ...encoding
                    });
                    return { uri: result.uri, location: `${target.label}/${filename}` };
                } catch {
                    // Try the next destination rather than losing the export.
                }
            }
        }

        const result = await Filesystem.writeFile({
            path: `exports/${filename}`,
            data,
            directory: Directory.Cache,
            recursive: true,
            ...encoding
        });
        return { uri: result.uri };
    }

    /**
     * `checkPermissions` already answers "granted" without a prompt on Android
     * 11 and up, where writing our own files to a public directory needs no
     * permission at all. Only API <= 29 actually sees the dialog.
     */
    private async publicStorageGranted(): Promise<boolean> {
        try {
            if ((await Filesystem.checkPermissions()).publicStorage === 'granted') {
                return true;
            }
            return (await Filesystem.requestPermissions()).publicStorage === 'granted';
        } catch {
            return false;
        }
    }

    /** Local `YYYY-MM-DD_HH-mm-ss`: these filenames are now something the user reads in a file browser. */
    private timestamp(): string {
        const now = new Date();
        const pad = (value: number) => `${value}`.padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
            + `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
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
