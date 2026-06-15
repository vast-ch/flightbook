import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EnrollmentComponent } from './enrollment.component';

const routes: Routes = [
  {
    path: ':token',
    component: EnrollmentComponent
  },
  {
    path: ':token/:payment',
    component: EnrollmentComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EnrollmentRoutingModule { }
