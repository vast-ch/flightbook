import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnrollmentComponent } from './enrollment.component';
import { EnrollmentRoutingModule } from './enrollment-routing.module';
import { SharedModule } from '../shared/shared.module';
import { LoginModule } from '../account/login/login.module';
import { UserRegisterModule } from '../account/user-register/user-register.module';
import { TranslateModule } from '@ngx-translate/core';



@NgModule({
  declarations: [
    EnrollmentComponent
  ],
  imports: [
    CommonModule,
    EnrollmentRoutingModule,
    TranslateModule.forChild(),
    SharedModule,
    LoginModule,
    UserRegisterModule
  ]
})
export class EnrollmentModule { }
