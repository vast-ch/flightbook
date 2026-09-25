import { Injectable, inject } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import * as fileSaver from 'file-saver';

/** IGC has no registered IANA type of its own; it's plain ASCII text. */
const IGC_MIME = 'text/plain';

/**
 * Where an Android download is offered to, best destination first - same
 * cascade as `SpreadsheetDownloadService`, see its comment for why
 * `ExternalStorage`/Download leads over `Documents`.
 */
const PUBLIC_TARGETS: {
    directory: Directory;
    folder: string;
    label: string;
}[] = [
    { directory: Directory.ExternalStorage, folder: 'Download', label: 'Download' },
    { directory: Directory.Documents, folder: 'Flightbook', label: 'Documents/Flightbook' }
];

interface SavedFile {
    /** Absolute file:// uri, for FileOpener. */
    uri: string;
    /** User-facing path. Absent when the file went to the app's private cache. */
    location?: string;
}

/**
 * Saves the already-decoded raw text of a flight's IGC file to the device and
 * opens it - the same "save natively / save on web, then open" shape as
 * `SpreadsheetDownloadService`, but for a single in-memory text payload with a
 * fixed, friendly filename (re-downloading overwrites, which is the desired
 * "download" semantic here, unlike a timestamped export).
 */
@Injectable({
    providedIn: 'root'
})
export class IgcDownloadService {
    private translate = inject(TranslateService);
    private loadingCtrl = inject(LoadingController);
    private alertController = inject(AlertController);

    async download(params: { filename: string; content: string }): Promise<void> {
        const { filename, content } = params;

        if (!Capacitor.isNativePlatform()) {
            fileSaver.saveAs(new Blob([content], { type: IGC_MIME }), filename);
            return;
        }

        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();

        let saved: SavedFile;
        try {
            saved = await this.save(filename, content);
        } catch {
            await loading.dismiss();
            await this.alert(this.translate.instant('message.igcDownloadError'));
            return;
        }

        await loading.dismiss();

        if (saved.location) {
            // Landed in public storage - the user can already find it there,
            // so don't also prompt to open it with some app.
            await this.alert(this.translate.instant('message.igcDownloadSaved', { location: saved.location }));
            return;
        }

        // Public storage wasn't reachable (permission denied, or iOS's
        // sandboxed Cache) - opening/sharing is the only way left to get the
        // file out, so offer that instead of just saying "saved" to a place
        // the user cannot browse.
        try {
            await FileOpener.open({ filePath: saved.uri, contentType: IGC_MIME });
            return;
        } catch {
            // No ACTION_VIEW handler either.
        }

        await this.alert(this.translate.instant('message.exportSavedNoViewer'));
    }

    /**
     * Writing to `target.directory` requests the OS permission internally
     * (on the Android versions that still need one) as part of the native
     * `writeFile` call itself - no separate JS-side permission check needed.
     */
    private async save(filename: string, content: string): Promise<SavedFile> {
        if (Capacitor.getPlatform() === 'android') {
            for (const target of PUBLIC_TARGETS) {
                try {
                    const result = await Filesystem.writeFile({
                        path: `${target.folder}/${filename}`,
                        data: content,
                        directory: target.directory,
                        recursive: true,
                        encoding: Encoding.UTF8
                    });
                    return { uri: result.uri, location: `${target.label}/${filename}` };
                } catch {
                    // Try the next destination rather than losing the download.
                }
            }
        }

        const result = await Filesystem.writeFile({
            path: `igc/${filename}`,
            data: content,
            directory: Directory.Cache,
            recursive: true,
            encoding: Encoding.UTF8
        });
        return { uri: result.uri };
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
