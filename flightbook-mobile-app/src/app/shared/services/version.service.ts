import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { environment } from 'src/environments/environment';

/**
 * The app version as it is shown to the pilot.
 *
 * On a device the store build is the truth, so it comes from the native bundle
 * and only lands once App.getInfo() resolves; on the web there is no such call
 * and the build-time version from environment is already correct. Resolved once
 * per app run - the root injector keeps this instance, so the four screens that
 * print the version share the same signal instead of each awaiting their own
 * getInfo().
 */
@Injectable({
    providedIn: 'root'
})
export class VersionService {

    private readonly _version = signal(Capacitor.isNativePlatform() ? '' : environment.appVersion);

    /** Empty on native until the native bundle answers, then the real version. */
    readonly version = this._version.asReadonly();

    constructor() {
        void this.resolve();
    }

    private async resolve(): Promise<void> {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        try {
            this._version.set((await App.getInfo()).version);
        } catch (error) {
            console.error('Reading the native app version failed:', error);
        }
    }
}
