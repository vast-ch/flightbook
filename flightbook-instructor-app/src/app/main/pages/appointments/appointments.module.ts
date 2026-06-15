import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentsComponent } from './appointments.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { AppointmentsRoutingModule } from './appointments-routing.module';
import { AppointmentFormDialogComponent } from '../../component/appointment-form-dialog/appointment-form-dialog.component';
import { SubscriptionsComponent } from '../../component/subscriptions/subscriptions.component';
import { FullCalendarModule } from '@fullcalendar/angular';



@NgModule({
  declarations: [
    AppointmentsComponent,
    AppointmentFormDialogComponent,
    SubscriptionsComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule.forChild(),
    SharedModule,
    AppointmentsRoutingModule,
    FormsModule,
    FullCalendarModule
  ]
})
export class AppointmentsModule { }
