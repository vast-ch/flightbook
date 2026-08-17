import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuardService } from './account/shared/auth-guard.service';
import { ForceUpdateGuard } from './shared/guards/force-update.guard';
import { TabsPage } from './tabs/tabs.page';

/**
 * Every authenticated screen lives inside the tab shell so the bottom bar stays
 * visible, while the URLs stay exactly as they were - existing routerLinks and
 * the push-notification deep links (/flights/:id, /school/:id) keep working.
 * Login and register sit outside the shell: no tab bar there.
 */
const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./account/login/login.module').then(m => m.LoginPageModule),
    canActivate: [ForceUpdateGuard]
  },
  {
    path: 'register',
    loadChildren: () => import('./account/register/register.module').then(m => m.RegisterPageModule)
  },
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('./home/home.module').then(m => m.HomePageModule),
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
        loadChildren: () => import('./flight/flight-list/flight-list.module').then(m => m.FlightListPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flights/add',
        loadChildren: () => import('./flight/flight-add/flight-add.module').then(m => m.FlightAddPageModule),
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
        loadChildren: () => import('./flight/flight-statistic/flight-statistic.module').then(m => m.FlightStatisticPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flights/:id',
        loadChildren: () => import('./flight/flight-edit/flight-edit.module').then(m => m.FlightEditPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'gliders',
        loadChildren: () => import('./glider/glider-list/glider-list.module').then(m => m.GliderListPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'gliders/add',
        loadChildren: () => import('./glider/glider-add/glider-add.module').then(m => m.GliderAddPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'gliders/:id',
        loadChildren: () => import('./glider/glider-edit/glider-edit.module').then(m => m.GliderEditPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'places',
        loadChildren: () => import('./place/place-list/place-list.module').then(m => m.PlaceListPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'places/add',
        loadChildren: () => import('./place/place-add/place-add.module').then(m => m.PlaceAddPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'places/:id',
        loadChildren: () => import('./place/place-edit/place-edit.module').then(m => m.PlaceEditPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'imports/igc',
        loadChildren: () => import('./imports/multiple-igc/multiple-igc.module').then(m => m.MultipleIgcPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'imports/data',
        loadChildren: () => import('./imports/data/data.module').then(m => m.DataPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'flight-edit',
        loadChildren: () => import('./flight/flight-edit/flight-edit.module').then(m => m.FlightEditPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'settings',
        loadChildren: () => import('./account/settings/settings.module').then(m => m.SettingsPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'school/:id',
        loadChildren: () => import('./school/appointment-list/appointment-list.module').then(m => m.AppointmentListPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'control-sheet',
        loadChildren: () => import('./school/control-sheet/control-sheet.module').then(m => m.ControlSheetPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'passenger-confirmations',
        loadChildren: () => import('./tandem/passenger-confirmation-list/passenger-confirmation-list.module').then(m => m.PassengerConfirmationListPageModule),
        canActivate: [AuthGuardService]
      },
      {
        path: 'more',
        loadChildren: () => import('./more/more.module').then(m => m.MorePageModule),
        canActivate: [AuthGuardService]
      }
    ]
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
