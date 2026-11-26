import {
    ApplicationConfig,
    importProvidersFrom,
    inject,
    provideAppInitializer,
    provideCheckNoChangesConfig,
    provideZonelessChangeDetection,
} from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import germanLocale from '@angular/common/locales/de';
import italianLocale from '@angular/common/locales/it';
import frenchLocale from '@angular/common/locales/fr';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { keyboardOverlaysWebview, scrollAssistKeyboardHeight } from './shared/util/keyboard';
import { HttpAuthInterceptor } from './shared/interceptor/auth.interceptor';
import { HttpErrorInterceptor } from './shared/interceptor/error.interceptor';
import { NavigationService } from './shared/services/navigation.service';

registerLocaleData(germanLocale);
registerLocaleData(italianLocale);
registerLocaleData(frenchLocale);

export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

function ionicConfig() {
    return {
        innerHTMLTemplatesEnabled: true,
        swipeBackEnabled: true,
        // See shared/util/keyboard.ts: Ionic's default (290) misses the Save
        // footer lifted onto the keyboard, so fields just above it went under.
        // iOS only - Android resizes the webview and keeps Ionic's default.
        ...(keyboardOverlaysWebview() ? { keyboardHeight: scrollAssistKeyboardHeight() } : {}),
    };
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes, withPreloading(PreloadAllModules)),
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(ionicConfig()),
        provideHttpClient(withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: HttpAuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
        // ngx-translate 14 has no provideTranslateService().
        importProvidersFrom(
            TranslateModule.forRoot({
                loader: { provide: TranslateLoader, useFactory: createTranslateLoader, deps: [HttpClient] },
            }),
        ),
        // PdfExportService formats dates with it.
        DatePipe,
        // NavigationService listens to router events from the first navigation
        // on, so it must exist before anything asks for it.
        provideAppInitializer(() => {
            inject(NavigationService);
        }),
        // e2e change-detection check only (environment.e2e.ts): log NG0100 for any
        // binding that changed without Angular being notified. Dev mode only.
        ...(environment.checkNoChanges ? [provideCheckNoChangesConfig({ exhaustive: true, interval: 500 })] : []),
    ],
};
