import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuardService } from './core/services/auth-guard.service';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./main/main.module').then(m => m.MainModule),
    canActivate: [AuthGuardService]
  },
  {
    path: 'login',
    loadChildren: () => import('./account/login/login.module').then(m => m.LoginModule),
  },
  {
    path: 'school/register',
    loadChildren: () => import('./account/school-register/school-register.module').then(m => m.SchoolRegisterModule),
  },
  {
    path: 'enrollments',
    loadChildren: () => import('./enrollment/enrollment.module').then(m => m.EnrollmentModule),
  },
  { path: 'no-school',
    loadComponent: () => import('./account/no-school/no-school.component').then(m => m.NoSchoolComponent) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
