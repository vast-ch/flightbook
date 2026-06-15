import { Component, OnInit } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { TranslateService } from '@ngx-translate/core';
import { School } from 'src/app/shared/domain/school';

@Component({
    selector: 'app-school-register',
    templateUrl: './school-register.component.html',
    styleUrls: ['./school-register.component.scss'],
    standalone: false
})
export class SchoolRegisterComponent implements OnInit {

  hasAccount?: boolean;
  school: School;
  link = "https://instructor.flightbook.ch";

  constructor(
    private translate: TranslateService
  ) {
    this.school = new School();
    this.school.language = this.translate.currentLang;
  }

  ngOnInit(): void {
  }

  async loginEvent(loggedIn: boolean, stepper: MatStepper) {
    if (loggedIn) {
      stepper.next();
    }
  }

  hasFbAccount(hasAccount: boolean) {
    this.hasAccount = hasAccount;
  }

  setLanguage(lang: string) {
    localStorage.setItem('language', lang);
    this.translate.use(lang);
    this.school.language = lang;
  }

  async schoolSaved(saved: boolean, stepper: MatStepper) {
    if (saved) {
      stepper.next();
    }
  }

}
