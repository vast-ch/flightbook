import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * The languages the app ships strings for, and the only ones whose Angular
 * locale data is registered (de/fr/it in app.module.ts; en is built in).
 */
export const SUPPORTED_LANGUAGES = ['de', 'fr', 'it', 'en'];

export const DEFAULT_LANGUAGE = 'en';

/**
 * Narrows any candidate - a stored preference, `navigator.language`, whatever
 * ngx-translate reports - to a language the app actually has.
 *
 * Without this a device set to, say, Spanish reaches `translate.use('es')`;
 * ngx-translate assigns `currentLang = 'es'` synchronously even though es.json
 * 404s, and every `date:...:currentLang` binding then throws NG0701 "Missing
 * locale data" on each change-detection pass, blanking the Flights tab.
 */
export function resolveLanguage(candidate?: string | null): string {
    const lang = (candidate ?? '').split('-')[0].toLowerCase();
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

/**
 * The active language, as a signal.
 *
 * ngx-translate 14 exposes `currentLang` as a plain string, so a computed() that
 * formats a date would never re-evaluate when the user switches language -
 * setLanguage() calls translate.use() without reloading the app. Mirroring the
 * language into a signal makes those labels reactive.
 *
 * Read this - never `translate.currentLang` - wherever a date or number is
 * formatted, so the value is both reactive and known to be a registered locale.
 */
@Injectable({
    providedIn: 'root'
})
export class LanguageService {
    private translate = inject(TranslateService);

    private state = signal<string>(resolveLanguage(this.translate.currentLang || this.translate.getDefaultLang()));

    /** Read this wherever a date or number is formatted for display. */
    public readonly lang = this.state.asReadonly();

    constructor() {
        this.translate.onLangChange.subscribe(event => this.state.set(resolveLanguage(event.lang)));
    }

    /** The one place that persists the choice and switches the bundle. */
    setLanguage(candidate: string): void {
        const lang = resolveLanguage(candidate);
        localStorage.setItem('language', lang);
        this.translate.use(lang);
        this.state.set(lang);
    }
}
