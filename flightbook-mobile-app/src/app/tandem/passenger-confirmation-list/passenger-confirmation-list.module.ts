import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PasengerConfirmationListPageRoutingModule } from './passenger-confirmation-list-routing.module';

import { PassengerConfirmationListPage } from './passenger-confirmation-list.page';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    PasengerConfirmationListPageRoutingModule,
    TranslateModule.forChild(),
    SharedModule,
    PassengerConfirmationListPage
  ]
})
export class PassengerConfirmationListPageModule {}
