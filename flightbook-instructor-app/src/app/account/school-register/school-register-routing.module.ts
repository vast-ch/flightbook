import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SchoolRegisterComponent } from './school-register.component';

const routes: Routes = [
  {
    path: '',
    component: SchoolRegisterComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SchoolRegisterRoutingModule { }
