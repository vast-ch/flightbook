import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AccountService } from 'src/app/account/shared/account.service';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { GliderStore } from 'src/app/glider/shared/glider.store';
import { PlaceStore } from 'src/app/place/shared/place.store';
import { SchoolService } from 'src/app/school/shared/school.service';
import { TandemSchoolService } from 'src/app/school/shared/tandem-school.service';
import { HomeStore } from 'src/app/home/shared/home.store';
import { StatisticStore } from 'src/app/flight/flight-statistic/shared/statistic.store';

/**
 * Owns the sign-out teardown so the side menu and the More page can't drift
 * apart on what actually gets cleared.
 */
@Injectable({
    providedIn: 'root'
})
export class SessionService {
    private accountService = inject(AccountService);
    private flightStore = inject(FlightStore);
    private gliderStore = inject(GliderStore);
    private placeStore = inject(PlaceStore);
    private schoolService = inject(SchoolService);
    private tandemSchoolService = inject(TandemSchoolService);
    private homeStore = inject(HomeStore);
    private statisticStore = inject(StatisticStore);

    /**
     * Whether the once-per-session bootstrap (identity, entitlements, push
     * token) has run. It lives here rather than on AppComponent so that signing
     * out can reset it - the app does not reload, so without this the next user
     * to sign in would inherit the previous one's identity and entitlements.
     */
    private bootstrapped = false;

    get sessionBootstrapped(): boolean {
        return this.bootstrapped;
    }

    markBootstrapped(): void {
        this.bootstrapped = true;
    }

    /**
     * Stores are cleared up front so no cached logbook survives a failed
     * request, and the tokens go once the server has accepted the logout.
     */
    logout(): Observable<any> {
        this.flightStore.clearFlights();
        this.gliderStore.clearGliders();
        this.placeStore.clearPlaces();

        return this.accountService.logout(localStorage.getItem('refresh_token')).pipe(
            tap(() => this.clearLocalSession())
        );
    }

    /**
     * Drops every trace of the session held on the device. Separate from
     * logout() because deleting an account has already destroyed the
     * server-side session - there is nothing left to sign out of.
     */
    clearLocalSession(): void {
        this.flightStore.clearFlights();
        this.gliderStore.clearGliders();
        this.placeStore.clearPlaces();
        this.schoolService.clearSchools();
        this.tandemSchoolService.clearSchools();
        // Both gate their reloads on a `loaded` flag, so leaving them would show
        // the previous account's totals to the next one.
        this.homeStore.clear();
        this.statisticStore.clear();
        this.bootstrapped = false;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('last_login');
    }
}
