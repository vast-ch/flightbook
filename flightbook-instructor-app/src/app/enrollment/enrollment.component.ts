import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from '../core/services/account.service';
import { EnrollmentService } from '../core/services/enrollment.service';
import { Enrollment } from '../shared/domain/enrollment';
import { EnrollmentType } from '../shared/domain/enrollmentType';

type StepKey = 'account' | 'payment' | 'accept' | 'done';

/** Invitation flow from Enrollment.dc.html: account → payment (students, tandem pilots) → accept → done. */
@Component({
    selector: 'fb-enrollment',
    templateUrl: './enrollment.component.html',
    styleUrls: ['./enrollment.component.scss'],
    standalone: false
})
export class EnrollmentComponent implements OnDestroy {
  unsubscribe$ = new Subject<void>();
  enrollment: Enrollment | undefined;
  loading = true;
  init = false;
  step = 0;

  readonly EnrollmentType = EnrollmentType;
  readonly languages = ['fr', 'de'];

  private token: string | null;

  constructor(
    private route: ActivatedRoute,
    private enrollmentService: EnrollmentService,
    private accountService: AccountService,
    private translate: TranslateService
  ) {
    this.token = this.route.snapshot.paramMap.get('token');

    if (!this.token) {
      this.loading = false;
      this.init = true;
      return;
    }

    this.enrollmentService.getEnrollmentByToken(this.token).pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: (resp: Enrollment) => {
        this.loading = false;
        this.init = true;
        this.enrollment = resp || undefined;
        // Back from Stripe: the user is still logged in.
        const paymentStatus = this.route.snapshot.paramMap.get('payment');
        if (paymentStatus == "success") {
          this.goTo('accept');
        } else if (paymentStatus == "cancel") {
          this.goTo('payment');
        }
      },
      // Unknown or expired token: show the invalid-invitation card instead of an endless spinner.
      error: () => {
        this.loading = false;
        this.init = true;
        this.enrollment = undefined;
      }
    });
  }

  get steps(): { key: StepKey, label: string }[] {
    const steps: { key: StepKey, label: string }[] = [
      { key: 'account', label: this.enrollment?.isUser ? 'login.title' : 'account.register' }
    ];
    if (this.hasPayment) {
      steps.push({ key: 'payment', label: 'enrollment.payment' });
    }
    steps.push({ key: 'accept', label: 'enrollment.accept' }, { key: 'done', label: 'enrollment.confirmation' });
    return steps;
  }

  get currentStep(): StepKey {
    return this.steps[this.step]?.key ?? 'account';
  }

  get hasPayment(): boolean {
    return this.enrollment?.type === EnrollmentType.STUDENT || this.enrollment?.type === EnrollmentType.TANDEM_PILOT;
  }

  get trialEnabled(): boolean {
    return this.enrollment?.school?.configuration?.schoolModule?.trialEnabled === true;
  }

  get roleIcon(): string {
    switch (this.enrollment?.type) {
      case EnrollmentType.TEAM_MEMBER: return 'groups';
      case EnrollmentType.TANDEM_PILOT: return 'paragliding';
      default: return 'school';
    }
  }

  get roleKey(): string {
    switch (this.enrollment?.type) {
      case EnrollmentType.TEAM_MEMBER: return 'enrollment.role.team';
      case EnrollmentType.TANDEM_PILOT: return 'enrollment.role.tandem';
      default: return 'enrollment.role.student';
    }
  }

  get isTeam(): boolean {
    return this.enrollment?.type === EnrollmentType.TEAM_MEMBER;
  }

  get appUrl(): string {
    return this.isTeam ? 'https://instructor.flightbook.ch' : 'https://m.flightbook.ch';
  }

  get currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang;
  }

  isDone(index: number): boolean {
    return index < this.step;
  }

  goTo(key: StepKey) {
    const index = this.steps.findIndex(s => s.key === key);
    if (index !== -1) {
      this.step = index;
    }
  }

  setLanguage(lang: string) {
    localStorage.setItem('language', lang);
    this.translate.use(lang);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  /** An active subscription or a free enrollment skips the payment step. */
  async loginEvent(loggedIn: boolean) {
    if (!loggedIn) {
      return;
    }
    this.loading = true;
    try {
      const status = await firstValueFrom(this.accountService.getPaymentStatus());
      if (!status.active && this.enrollment?.school?.id && this.enrollment?.token) {
        const freeAccount = await firstValueFrom(this.enrollmentService.hasFreeEnrollment(this.enrollment.school.id, this.enrollment.token));
        if (freeAccount) {
          status.active = true;
        }
      }
      this.goTo(this.hasPayment && !status?.active ? 'payment' : 'accept');
    } finally {
      this.loading = false;
    }
  }

  validate() {
    if (this.token) {
      this.enrollmentService.acceptEnrollment(this.token).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: () => {
          this.goTo('done');
          this.accountService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe(resp => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          });
        }
      });
    }
  }

  async getStripeSession() {
    if (!this.token) {
      return;
    }
    this.loading = true;
    try {
      const session = await firstValueFrom(this.accountService.getStripeSession(this.token));
      window.open(session.url, '_self');
    } catch {
      this.loading = false;
    }
  }
}
