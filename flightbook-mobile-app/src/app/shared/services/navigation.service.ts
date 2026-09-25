import { Injectable } from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';
import { NavController, Platform } from '@ionic/angular/standalone';

/**
 * Above Ionic's own hardware-back handler (registered at priority 0 by
 * NavController itself) so ours runs first, but below overlays (100) and
 * menus (99) so an open modal/alert still gets first claim on the back
 * button and closes itself instead of triggering a navigation underneath it.
 */
const BACK_BUTTON_PRIORITY = 10;

/**
 * `<ion-tabs>` (tabs.page.html) renders its own nested `<ion-router-outlet
 * tabs="true">` internally (baked into Ionic's own component template, not
 * visible from this app's src/ tree). With `tabs="true"` that outlet keeps a
 * SEPARATE navigation stack per top-level route segment - so `more -> places`
 * makes place-list the ROOT of its own "places" stack, with nothing beneath
 * it to pop back to, and switching tabs (home/flights/statistics/more, via
 * IonTabs.select() -> navCtrl.navigateRoot()) only resets the target tab's own
 * stack, never touching the others - so hardware back can never cross from one
 * tab's stack into another's. (Gliders avoids this entirely: its routes are
 * registered under `more/gliders*` - see app-routing.module.ts - so they share
 * More's own stack instead of getting a fresh one.)
 *
 * The first group are pages reached from More with nothing else in their own
 * stack; the second are the three non-start tabs, matching Android's own
 * bottom-navigation guidance that back from a non-start tab should return to
 * the start destination (Home) rather than do nothing. 'home' is deliberately
 * absent: as the start destination, back from there should fall through to
 * the platform default (app minimize/exit), not loop back onto itself.
 */
const ROOT_SEGMENT_FALLBACKS: Record<string, string> = {
  places: 'more',
  imports: 'more',
  'passenger-confirmations': 'more',
  settings: 'more',
  'control-sheet': 'more',
  school: 'more',
  flights: 'home',
  statistics: 'home',
  more: 'home'
};

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private static readonly TRANSIENT_ROUTES = ['/login', '/register'];
  private MAX_HISTORY_LEN = 5; // prevent history from growing indefinitely
  private history: string[] = [];

  constructor(private router: Router, private navCtrl: NavController, private platform: Platform) {
    this.router.events.subscribe((event) => {
      if (event instanceof RoutesRecognized) {
        this.history.push(event.url);
        if (this.history.length > this.MAX_HISTORY_LEN) {
          this.history.shift();
        }
      }
    });

    /**
     * Ionic's own hardware-back/swipe-back handling only pops its own stack
     * and has no concept of a fallback - it silently does nothing once a
     * per-segment stack (see ROOT_SEGMENT_FALLBACKS above) is empty. This
     * mirrors back()'s pop-then-fallback logic for the hardware button,
     * deriving the fallback from the live URL rather than from per-page
     * state, so there is nothing to keep in sync or that can go stale as the
     * pilot moves between pages.
     */
    this.platform.backButton.subscribeWithPriority(BACK_BUTTON_PRIORITY, async (processNextHandler) => {
      if (await this.navCtrl.pop()) {
        return;
      }
      const fallback = this.rootFallback();
      if (fallback) {
        await this.navCtrl.navigateRoot(fallback);
        return;
      }
      // A real tab root (home, flights, statistics, more) or anything not
      // listed above - defer to Ionic's own default (priority 0) handler.
      processNextHandler();
    });
  }

  private rootFallback(): string | null {
    const segment = this.router.url.split('?')[0].split('/').filter(Boolean)[0];
    return ROOT_SEGMENT_FALLBACKS[segment] ?? null;
  }

  /**
   * Back out of a page that can be reached from more than one place, or out of
   * an edit/add page on close/save/delete.
   *
   * Goes back through Ionic's own IonRouterOutlet/StackController stack (the
   * same stack hardware-back and swipe-back use), instead of the real
   * browser/webview history - the two are independent, and using the browser's
   * history against the wrong one caused stale/duplicate-URL "back does
   * nothing the first time" bugs.
   *
   * The fallback still applies on a cold entry (a deep link or a restored PWA
   * route), where there is nothing in Ionic's own stack to pop.
   */
  async back(fallback: string): Promise<void> {
    if (await this.navCtrl.pop()) {
      return;
    }
    await this.navCtrl.navigateRoot(fallback);
  }

  /**
   * Redirect to wherever the pilot was headed before AuthGuardService bounced
   * them to /login. That attempt never activates, so it never enters Ionic's
   * own stack - this array is the only record of it. Resets Ionic's stack via
   * navigateRoot so /login isn't left sitting underneath the target page.
   */
  async backToPendingRoute(): Promise<void> {
    this.history.pop(); // Remove current page (/login)
    if (this.history.length > 0 && this.previousIsNotTransient()) {
      const previousUrl = this.history[this.history.length - 1];
      await this.navCtrl.navigateRoot(previousUrl);
    } else {
      await this.navCtrl.navigateRoot('/');
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  /**
   * '/register' was already excluded (finishing registration shouldn't loop
   * back to the signup form). '/login' itself needs the same treatment - e.g.
   * bouncing from /register to /login and back can leave consecutive '/login'
   * entries in history, which would otherwise redirect a fresh login straight
   * back to the login page it was just submitted from.
   */
  private previousIsNotTransient(): boolean {
    return !NavigationService.TRANSIENT_ROUTES.includes(this.history[this.history.length - 2])
      && !NavigationService.TRANSIENT_ROUTES.includes(this.history[this.history.length - 1]);
  }
}
