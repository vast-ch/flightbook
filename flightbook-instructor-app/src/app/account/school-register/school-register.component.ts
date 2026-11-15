import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { School } from 'src/app/shared/domain/school';

type Step = 1 | 2 | 3;

@Component({
    selector: 'app-school-register',
    templateUrl: './school-register.component.html',
    styleUrls: ['./school-register.component.scss'],
    standalone: false
})
export class SchoolRegisterComponent {

  hasAccount?: boolean;
  school: School;
  link = "https://instructor.flightbook.ch";

  /** Own step bar instead of mat-stepper (Register.dc.html). */
  step: Step = 1;
  readonly steps: { n: Step, label: string }[] = [
    { n: 1, label: 'account.title' },
    { n: 2, label: 'school.school' },
    { n: 3, label: 'school.confirmation' }
  ];
  readonly languages = ['fr', 'de'];

  constructor(
    private translate: TranslateService
  ) {
    this.school = new School();
    this.school.language = this.translate.currentLang;
  }

  get currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang;
  }

  isDone(n: Step): boolean {
    return n < this.step;
  }

  /** Back to a finished step, but not once the school exists (step 3). */
  canGoTo(n: Step): boolean {
    return this.isDone(n) && this.step < 3;
  }

  goTo(n: Step) {
    if (this.canGoTo(n)) {
      this.step = n;
    }
  }

  loginEvent(loggedIn: boolean) {
    if (loggedIn) {
      this.step = 2;
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

  schoolSaved(saved: boolean) {
    if (saved) {
      this.step = 3;
    }
  }

}
