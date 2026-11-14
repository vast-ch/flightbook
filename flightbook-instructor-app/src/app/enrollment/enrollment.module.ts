import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnrollmentComponent } from './enrollment.component';
import { EnrollmentRoutingModule } from './enrollment-routing.module';
import { SharedModule } from '../shared/shared.module';
import { LoginModule } from '../account/login/login.module';
import { UserRegisterModule } from '../account/user-register/user-register.module';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { createTranslateLoader } from '../app.module';



@NgModule({
  declarations: [
    EnrollmentComponent
  ],
  imports: [
    CommonModule,
    EnrollmentRoutingModule,
    // With the HTTP loader, as in the login and school-register modules: a bare forChild() gives this
    // lazy module a loader that returns nothing, so switching to a language the app has not loaded
    // yet (e.g. FR on a first visit in German) silently kept the German texts.
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    SharedModule,
    LoginModule,
    UserRegisterModule
  ]
})
export class EnrollmentModule { }
