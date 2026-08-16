import { Location } from '@angular/common';
import { NavController } from '@ionic/angular/standalone';

/**
 * Back out of a page that can be reached from more than one place.
 *
 * The redesign put `fb-avatar-button` in the Home, Flights, Statistics and
 * Control-sheet headers, and reaches the school and confirmation screens from
 * Home and the tab bar's + sheet - so a hardcoded `navigateBack('more')` drops
 * the pilot on a tab they never came from.
 *
 * The fallback still applies on a cold entry (a deep link or a restored PWA
 * route), where there is no in-app history to pop.
 */
export function navigateBackOrTo(navCtrl: NavController, location: Location, fallback: string): void {
    const state = location.getState() as { navigationId?: number } | null;
    if (state?.navigationId > 1) {
        navCtrl.back();
        return;
    }
    navCtrl.navigateBack(fallback);
}
