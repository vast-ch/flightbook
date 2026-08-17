import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AccountDataPage } from './account-data.page';

const routes: Routes = [
  {
    path: '',
    component: AccountDataPage
  },
  {
    path: ':payment',
    component: AccountDataPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsPageRoutingModule {}
