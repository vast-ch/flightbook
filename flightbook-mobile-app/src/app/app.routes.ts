import { Routes } from '@angular/router';
import { AuthGuardService } from './account/shared/auth-guard.service';
import { ForceUpdateGuard } from './shared/guards/force-update.guard';
import { TabsPage } from './tabs/tabs.page';

/**
 * Every authenticated screen lives inside the tab shell so the bottom bar stays
 * visible, while the URLs stay exactly as they were - existing routerLinks and
 * the push-notification deep links (/flights/:id, /more/school/:id) keep
 * working. Login and register sit outside the shell: no tab bar there.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./account/login/login.page').then(m => m.LoginPage),
    canActivate: [ForceUpdateGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./account/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then(m => m.HomePage),
        canActivate: [ForceUpdateGuard, AuthGuardService]
      },
      {
        // Kept so old links and notification payloads still resolve.
        path: 'news',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'flights',
        loadComponent: () => import('./flight/flight-list/flight-list.page').then(m => m.FlightListPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flights/add',
        loadComponent: () => import('./flight/flight-add/flight-add.page').then(m => m.FlightAddPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * Statistics is a top-level segment, not a child of `flights`: Ionic
         * derives the selected tab from the first URL segment only, so under
         * `flights/statistic` the tab bar would always highlight Flights.
         * Declared before `flights/:id` so the old path can't match as an id.
         */
        path: 'flights/statistic',
        redirectTo: 'statistics',
        pathMatch: 'full'
      },
      {
        path: 'statistics',
        loadComponent: () => import('./flight/flight-statistic/flight-statistic.page').then(m => m.FlightStatisticPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flights/:id',
        loadComponent: () => import('./flight/flight-edit/flight-edit.page').then(m => m.FlightEditPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * Nested under `more` (not a top-level `gliders` segment) so glider
         * pages share the `more` tab's ion-router-outlet stack - see
         * NavigationService's ROOT_SEGMENT_FALLBACKS comment. Reached only
         * from the More menu, this lets iOS swipe-back from glider-list
         * reveal More underneath it instead of finding an empty stack.
         */
        path: 'more/gliders',
        loadComponent: () => import('./glider/glider-list/glider-list.page').then(m => m.GliderListPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more/gliders/add',
        loadComponent: () => import('./glider/glider-add/glider-add.page').then(m => m.GliderAddPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more/gliders/:id',
        loadComponent: () => import('./glider/glider-edit/glider-edit.page').then(m => m.GliderEditPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * Nested under `more`, same reasoning as gliders above - places is
         * only ever reached from the More menu.
         */
        path: 'more/places',
        loadComponent: () => import('./place/place-list/place-list.page').then(m => m.PlaceListPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more/places/add',
        loadComponent: () => import('./place/place-add/place-add.page').then(m => m.PlaceAddPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more/places/:id',
        loadComponent: () => import('./place/place-edit/place-edit.page').then(m => m.PlaceEditPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * Nested under `flights`, not `more`: unlike places/gliders, this is
         * opened from Home, Flight Statistics and Flight List's own "import"
         * actions - all flights-domain pages - so it shares the Flights tab's
         * stack instead.
         */
        path: 'flights/imports/igc',
        loadComponent: () => import('./imports/multiple-igc/multiple-igc.page').then(m => m.MultipleIgcPage),
        canActivate: [AuthGuardService]
      },
      {
        // More-only, unlike imports/igc above - nested under `more` instead.
        path: 'more/imports/data',
        loadComponent: () => import('./imports/data/data.page').then(m => m.DataPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flight-edit',
        loadComponent: () => import('./flight/flight-edit/flight-edit.page').then(m => m.FlightEditPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * NOT nested under `more`, unlike its siblings below: the Stripe
         * checkout redirect is hardcoded server-side (flightbook-api,
         * read-only here) to `{origin}/settings/success` and `.../cancel`,
         * and flightbook-website links straight to /settings from its
         * premium CTA and the account-deletion page. Moving this path would
         * break both.
         */
        path: 'settings',
        loadComponent: () => import('./account/settings/account-data.page').then(m => m.AccountDataPage),
        canActivate: [AuthGuardService]
      },
      {
        // Stripe's return: /settings/success and /settings/cancel (see above).
        path: 'settings/:payment',
        loadComponent: () => import('./account/settings/account-data.page').then(m => m.AccountDataPage),
        canActivate: [AuthGuardService]
      },
      {
        /*
         * Nested under `more` even though Home's next-appointment card and
         * push notifications also link here - see NavigationService's
         * ROOT_SEGMENT_FALLBACKS comment for the accepted trade-off.
         */
        path: 'more/school/:id',
        loadComponent: () => import('./school/appointment-list/appointment-list.page').then(m => m.AppointmentListPage),
        canActivate: [AuthGuardService]
      },
      {
        // Same trade-off as school/:id above - also reachable from Home.
        path: 'more/control-sheet',
        loadComponent: () => import('./school/control-sheet/control-sheet.page').then(m => m.ControlSheetPage),
        canActivate: [AuthGuardService]
      },
      {
        // Same trade-off as school/:id above - also reachable from the tab bar's global "+" add-sheet.
        path: 'more/passenger-confirmations',
        loadComponent: () => import('./tandem/passenger-confirmation-list/passenger-confirmation-list.page').then(m => m.PassengerConfirmationListPage),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more',
        loadComponent: () => import('./more/more.page').then(m => m.MorePage),
        canActivate: [AuthGuardService]
      }
    ]
  }
];
