import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { VersionService } from 'src/app/shared/services/version.service';

/** How many rotating status lines splash.lines carries, per locale. */
const LINE_COUNT = 8;

/** How long each line is shown. */
const LINE_INTERVAL = 1100;

/**
 * Past this the boot has stopped looking like a boot, so the rotating copy gives
 * way to something that admits it is waiting. Neither guard has an HTTP timeout:
 * ForceUpdateGuard fails open and AuthGuardService.isAuth() falls through to
 * login, so this only changes what is said, never what is awaited.
 */
const STALLED_AFTER = 8000;

/**
 * The boot screen, shown from app start until the first routed page activates.
 *
 * Deliberately dependency-light - AppComponent renders it, so anything imported
 * here lands in the initial bundle ahead of the login screen. See the note in
 * shared/services/session-teardown.registry.ts, where one static store import
 * put moment-timezone's IANA database in front of first paint.
 */
@Component({
    selector: 'fb-loading-screen',
    templateUrl: './loading-screen.component.html',
    styleUrls: ['./loading-screen.component.scss'],
    imports: [TranslateModule]
})
export class LoadingScreenComponent implements OnInit, OnDestroy {
    private lineIndex = signal(0);
    private stalled = signal(false);

    private lineTimer?: ReturnType<typeof setInterval>;
    private stalledTimer?: ReturnType<typeof setTimeout>;

    /** Rendered under the version, as the design draws it. */
    public version = inject(VersionService).version;

    /**
     * The key rather than the string: reading it through the pipe keeps the line
     * correct when the bundle for the stored language lands mid-boot.
     */
    public lineKey = computed(() =>
        this.stalled()
            ? 'splash.stillConnecting'
            : `splash.lines.${(this.lineIndex() % LINE_COUNT) + 1}`);

    ngOnInit(): void {
        this.lineTimer = setInterval(() => this.lineIndex.update(i => i + 1), LINE_INTERVAL);
        this.stalledTimer = setTimeout(() => this.stalled.set(true), STALLED_AFTER);
    }

    ngOnDestroy(): void {
        clearInterval(this.lineTimer);
        clearTimeout(this.stalledTimer);
    }
}
