import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainComponent } from './main.component';
import { startPageGuard } from '../core/services/start-page.guard';

const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    children: [
      { path: '', pathMatch: 'full', canActivate: [startPageGuard], children: [] },
      { path: 'students', loadChildren: () => import('./pages/students/students.module').then(m => m.StudentsModule) },
      { path: 'tandem-pilots', loadComponent: () => import('./pages/tandem-pilots/tandem-pilots.component').then(m => m.TandemPilotsComponent) },
      { path: 'appointments', pathMatch: 'full', loadChildren: () => import('./pages/appointments/appointments.module').then(m => m.AppointmentsModule) },
      { path: 'configuration', pathMatch: 'full', loadChildren: () => import('./pages/configuration/configuration.module').then(m => m.ConfigurationModule) }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MainRoutingModule { }
