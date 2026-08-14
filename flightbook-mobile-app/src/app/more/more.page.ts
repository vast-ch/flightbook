import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AccountService } from '../account/shared/account.service';
import { Link } from '../account/shared/userConfig.model';
import { SchoolService } from '../school/shared/school.service';
import { ControlSheet } from '../shared/domain/control-sheet';
import { FlightExportService } from '../shared/services/flight-export.service';
import { SessionService } from '../shared/services/session.service';
import { AvatarButtonComponent } from 'src/app/shared/components/avatar-button/avatar-button.component';

const DABS_URLS = {
    today: 'https://www.skybriefing.com/o/dabs?today',
    tomorrow: 'https://www.skybriefing.com/o/dabs?tomorrow'
};

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
        TranslateModule,
        IonContent,
        IonIcon
    ]
})
export class MorePage implements OnDestroy {
    private unsubscribe$ = new Subject<void>();

    private accountService = inject(AccountService);
    private schoolService = inject(SchoolService);
    private sessionService = inject(SessionService);
    private flightExportService = inject(FlightExportService);
    private router = inject(Router);

    public appVersion = environment.appVersion;

    public schools = this.schoolService.schoolsSignal;

    // null means "not fetched yet", which is what keeps a cached tab from
    // re-requesting it on every visit.
    private controlSheet = signal<boolean | null>(null);

    public hasControlSheet = computed(() => this.controlSheet() === true);

    /** Either a school or a control sheet earns the section. */
    public showSchoolSection = computed(() =>
        (this.schools()?.length ?? 0) > 0 || this.hasControlSheet()
    );

    private preparation = computed(() => this.accountService.currentUser$()?.config?.preparation);

    public customLinks = computed<Link[]>(() => this.preparation()?.links ?? []);

    constructor() {
        addIcons({
            chevronForward,
            glider: 'assets/custom-ion-icons/glider.svg',
            place: 'assets/custom-ion-icons/place.svg',
            tandem: 'assets/custom-ion-icons/tandem.svg'
        });
    }

    // ionViewWillEnter, not ngOnInit: Ionic caches pages, so this is what runs
    // again when the user comes back to the tab.
    ionViewWillEnter() {
        this.schoolService.getSchools();

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

    openDabs(when: 'today' | 'tomorrow') {
        Browser.open({ url: DABS_URLS[when] });
    }

    /** Store link for the SHV/FSVL app: App Store on iOS, Play Store elsewhere. */
    openShvApp() {
        const url = Capacitor.getPlatform() === 'ios' ? SHV_APP_URLS.ios : SHV_APP_URLS.other;
        Browser.open({ url });
    }

    openLink(url: string) {
        if (!url || url === '') {
            return;
        }
        Browser.open({ url });
    }

    openExport() {
        this.flightExportService.openExport();
    }

    logout() {
        this.sessionService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe({
            // Leave regardless: the local session is already gone either way.
            next: () => this.router.navigate(['login']),
            error: () => this.router.navigate(['login'])
        });
    }
}
