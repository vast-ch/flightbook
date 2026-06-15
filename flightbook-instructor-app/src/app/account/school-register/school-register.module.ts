import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SchoolRegisterRoutingModule } from './school-register-routing.module';
import { SchoolRegisterComponent } from './school-register.component';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { createTranslateLoader } from 'src/app/app.module';
import { HttpClient } from '@angular/common/http';
import { UserRegisterModule } from '../user-register/user-register.module';
import { LoginModule } from '../login/login.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { SchoolRegisterFormComponent } from './component/school-register-form/school-register-form.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    SchoolRegisterComponent,
    SchoolRegisterFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SchoolRegisterRoutingModule,
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
export class SchoolRegisterModule { }
