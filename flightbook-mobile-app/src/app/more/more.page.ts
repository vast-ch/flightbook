import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon, IonInput, IonReorder, IonReorderGroup, ReorderEndCustomEvent } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, chevronForward, openOutline, remove } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AccountService } from '../account/shared/account.service';
import { Link } from '../account/shared/userConfig.model';
import { User } from '../account/shared/user.model';
import { SchoolService } from '../school/shared/school.service';
import { ControlSheet } from '../shared/domain/control-sheet';
import { LogbookExportService } from '../shared/services/logbook-export.service';
import { SessionService } from '../shared/services/session.service';
import { VersionService } from '../shared/services/version.service';
import { AvatarButtonComponent } from 'src/app/shared/components/avatar-button/avatar-button.component';

const DABS_URLS = {
    today: 'https://www.skybriefing.com/o/dabs?today',
    tomorrow: 'https://www.skybriefing.com/o/dabs?tomorrow'
};

/** Leading "flight school" in the languages the app ships, plus the English word. */
const SCHOOL_WORD = /^(flugschule|flight\s+school|paragliding\s+school|school|[ée]cole(\s+de\s+parapente)?|scuola(\s+di\s+parapendio)?)\s+/i;

const SHV_APP_URLS = {
    ios: 'https://apps.apple.com/us/app/shv-fsvl/id6761252391',
    other: 'https://play.google.com/store/apps/details?id=ch.shv_fsvl'
};

@Component({
    selector: 'app-more',
    templateUrl: './more.page.html',
    styleUrls: ['./more.page.scss'],
    imports: [
        AvatarButtonComponent,
        FormsModule,
        TranslateModule,
        IonContent,
        IonIcon,
        IonInput,
        IonReorder,
        IonReorderGroup
    ]
})
export class MorePage implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    private accountService = inject(AccountService);
    private schoolService = inject(SchoolService);
    private sessionService = inject(SessionService);
    private logbookExportService = inject(LogbookExportService);
    private router = inject(Router);
    private alertController = inject(AlertController);
    private translate = inject(TranslateService);

    public version = inject(VersionService).version;

    public schools = this.schoolService.schoolsSignal;

    // null means "not fetched yet", which is what keeps a cached tab from
    // re-requesting it on every visit.
    private controlSheet = signal<boolean | null>(null);

    public hasControlSheet = computed(() => this.controlSheet() === true);

    /** Either a school or a control sheet earns the section. */
    public showSchoolSection = computed(() =>
        (this.schools()?.length ?? 0) > 0 || this.hasControlSheet()
    );

    /**
     * The name for the section label, or null when it cannot stand for the whole
     * section - which is any case other than exactly one school.
     */
    public schoolLabel = computed<string | null>(() => {
        const schools = this.schools() ?? [];
        return schools.length === 1 ? this.withoutSchoolWord(schools[0].name) : null;
    });

    /**
     * Schools are commonly registered as "Flugschule Schmid", and the label
     * already says School - so drop the leading school word rather than read
     * "School Flugschule Schmid". Anything unrecognised is left whole.
     */
    private withoutSchoolWord(name: string | undefined): string | null {
        if (!name) {
            return null;
        }
        const trimmed = name.trim().replace(SCHOOL_WORD, '');
        return trimmed.length > 0 ? trimmed : name.trim();
    }

    private preparation = computed(() => this.accountService.currentUser$()?.config?.preparation);

    public customLinks = computed<Link[]>(() => this.preparation()?.links ?? []);

    constructor() {
        addIcons({
            add,
            remove,
            'open-outline': openOutline,
            chevronForward,
            glider: 'assets/custom-ion-icons/glider.svg',
            place: 'assets/custom-ion-icons/place.svg',
            tandem: 'assets/custom-ion-icons/tandem.svg'
        });
    }

    // ionViewWillEnter, not ngOnInit: Ionic caches pages, so this is what runs
    // again when the user comes back to the tab.
    ionViewWillEnter() {
        // Caught: getSchools() rethrows, and a bare call left an unhandled
        // rejection on every visit to the tab when the request failed.
        this.schoolService.getSchools().catch(() => { /* the School section just stays empty */ });

        if (this.controlSheet() === null) {
            this.schoolService.getControlSheet().pipe(takeUntil(this.unsubscribe$)).subscribe({
                next: (controlSheet: ControlSheet) => this.controlSheet.set(!!controlSheet),
                // A user without a school has no sheet; record that instead of
                // leaving an unhandled error and retrying on every tab visit.
                error: () => this.controlSheet.set(false)
            });
        }
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    open(route: string | any[]) {
        this.router.navigate(Array.isArray(route) ? route : [route]);
    }

    // ---- Before you fly: the pilot's own links ---------------------------

    public editingLinks = signal(false);

    /**
     * The row being added or edited. index === null means a new link.
     * `original` is what the row held when the editor opened - reorder and
     * remove stay live underneath it, so the captured index alone would point
     * at a different link by the time Save is tapped.
     */
    public draft = signal<{ index: number | null; label: string; url: string; original?: Link } | null>(null);

    public draftError = signal<string | null>(null);

    public canSaveDraft = computed(() => {
        const entry = this.draft();
        return !!entry?.label?.trim() && /^https?:\/\/.+/.test(entry?.url?.trim() ?? '');
    });

    /** Hosts for the built-in rows, so every row reads the same way. */
    public get dabsHost(): string {
        return this.hostOf(DABS_URLS.today);
    }

    public get shvHost(): string {
        return this.hostOf(this.shvUrl());
    }

    private shvUrl(): string {
        return Capacitor.getPlatform() === 'ios' ? SHV_APP_URLS.ios : SHV_APP_URLS.other;
    }

    /** The design puts the host under the name; the full URL rarely fits. */
    hostOf(url: string): string {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }

    toggleLinkEdit() {
        this.editingLinks.update(editing => !editing);
        this.draft.set(null);
        this.draftError.set(null);
    }

    startLink() {
        this.draft.set({ index: null, label: '', url: '' });
        this.draftError.set(null);
    }

    editLink(index: number) {
        const link = this.customLinks()[index];
        this.draft.set({ index, label: link?.label ?? '', url: link?.url ?? '', original: link });
        this.draftError.set(null);
    }

    setDraftLabel(label: string) {
        this.draft.update(entry => entry ? { ...entry, label } : entry);
    }

    setDraftUrl(url: string) {
        this.draft.update(entry => entry ? { ...entry, url } : entry);
    }

    cancelLink() {
        this.draft.set(null);
        this.draftError.set(null);
    }

    async saveLink() {
        const entry = this.draft();
        if (!entry || !this.canSaveDraft()) {
            return;
        }
        const links = [...this.customLinks()];
        const link: Link = { label: entry.label.trim(), url: entry.url.trim() };
        if (entry.index === null) {
            links.push(link);
        } else {
            // Located by value: a drag or a delete while the editor was open
            // would otherwise make the captured index overwrite the wrong row.
            const target = entry.original
                ? links.findIndex(candidate =>
                    candidate.label === entry.original.label && candidate.url === entry.original.url)
                : entry.index;
            if (target < 0) {
                // The row went away underneath the editor; nothing to update.
                this.draft.set(null);
                return;
            }
            links[target] = link;
        }
        if (await this.persistLinks(links)) {
            this.draft.set(null);
        }
    }

    async removeLink(event: Event, index: number) {
        // The row itself opens the editor, so the remove button must not bubble.
        event.stopPropagation();
        const links = [...this.customLinks()];
        links.splice(index, 1);
        // Only once the write landed: persistLinks deliberately leaves the user
        // signal alone on failure, so closing the editor on the local splice
        // dropped the pilot back to a list still showing the link they had just
        // been told could not be removed.
        if (await this.persistLinks(links) && links.length === 0) {
            this.editingLinks.set(false);
        }
    }

    async handleReorderEnd(event: ReorderEndCustomEvent) {
        const links = event.detail.complete([...this.customLinks()]) as Link[];
        await this.persistLinks(links);
    }

    /**
     * There is no Save button on this screen, so every change writes through.
     * The user signal is only replaced by a successful response, which is what
     * lets a failed save leave the list exactly as it was.
     */
    private async persistLinks(links: Link[]): Promise<boolean> {
        const user = structuredClone(this.accountService.currentUser$()) as User;
        if (!user) {
            return false;
        }
        user.config = user.config ?? {};
        user.config.preparation = user.config.preparation ?? {};
        user.config.preparation.links = links;

        try {
            await firstValueFrom(this.accountService.updateUser(user));
            this.draftError.set(null);
            return true;
        } catch {
            this.draftError.set('message.error');
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('message.error'),
                buttons: [this.translate.instant('buttons.done')]
            });
            await alert.present();
            return false;
        }
    }

    openDabs(when: 'today' | 'tomorrow') {
        Browser.open({ url: DABS_URLS[when] });
    }

    /** Store link for the SHV/FSVL app: App Store on iOS, Play Store elsewhere. */
    openShvApp() {
        Browser.open({ url: this.shvUrl() });
    }

    openLink(url: string) {
        if (!url || url === '') {
            return;
        }
        Browser.open({ url });
    }

    openExport() {
        this.logbookExportService.openFullExport();
    }

    logout() {
        this.sessionService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe({
            // Leave regardless: the local session is already gone either way.
            next: () => this.router.navigate(['login']),
            error: () => this.router.navigate(['login'])
        });
    }
}
