import { Injectable } from '@angular/core';

/**
 * State that must be dropped when the session ends, registered by whoever owns
 * it rather than listed inside SessionService.
 *
 * SessionService is constructed eagerly by AppComponent, so a static import of
 * a feature store there pulls that store - and everything it imports - into the
 * initial bundle. HomeStore imports moment-timezone, whose IANA database is
 * ~700 KB, and it was being downloaded before the login screen could paint.
 *
 * A store only registers once it has been constructed, which is exactly when it
 * has state worth clearing.
 */
@Injectable({
    providedIn: 'root'
})
export class SessionTeardownRegistry {
    private handlers = new Set<() => void>();

    register(handler: () => void): void {
        this.handlers.add(handler);
    }

    runAll(): void {
        this.handlers.forEach(handler => handler());
    }
}
