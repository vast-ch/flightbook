import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * The active language, as a signal.
 *
 * ngx-translate 14 exposes `currentLang` as a plain string, so a computed() that
 * formats a date would never re-evaluate when the user switches language -
 * setLanguage() calls translate.use() without reloading the app. Mirroring the
 * language into a signal makes those labels reactive.
 *
 * Angular locale data for de/fr/it is registered in app.module.ts; en is built in.
 */
@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private translate = inject(TranslateService);

    private state = signal<string>(this.translate.currentLang || this.translate.getDefaultLang() || 'en');

    /** Read this wherever a date or number is formatted for display. */
    public readonly lang = this.state.asReadonly();

    constructor() {
        this.translate.onLangChange.subscribe(event => this.state.set(event.lang));
    }
}
