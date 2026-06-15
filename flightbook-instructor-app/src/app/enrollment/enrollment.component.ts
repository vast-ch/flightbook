import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from '../core/services/account.service';
import { EnrollmentService } from '../core/services/enrollment.service';
import { Enrollment } from '../shared/domain/enrollment';
import { EnrollmentType } from '../shared/domain/enrollmentType';

@Component({
    selector: 'fb-enrollment',
    templateUrl: './enrollment.component.html',
    styleUrls: ['./enrollment.component.scss'],
    standalone: false
})
export class EnrollmentComponent implements OnInit, OnDestroy {
  unsubscribe$ = new Subject<void>();
  enrollment: Enrollment | undefined;
  loading = true;
  init = false;
  @ViewChild("stepper", { static: false })
  stepper?: MatStepper

  private token: string | null;

  constructor(
    private route: ActivatedRoute,
    private enrollmentService: EnrollmentService,
    private accountService: AccountService
  ) {
    this.token = this.route.snapshot.paramMap.get('token');

    if (this.token) {
      this.enrollmentService.getEnrollmentByToken(this.token).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: (resp: Enrollment) => {
          this.loading = false;
          this.init = true
          this.enrollment = resp;
          const paymentStatus = this.route.snapshot.paramMap.get('payment');
          if (paymentStatus == "success") {
            setTimeout(() => {
              this.stepper?.next();
              this.stepper?.next();
            }, 10);
          } else if (paymentStatus == "cancel") {
            setTimeout(() => {
              this.stepper?.next();
            }, 10);
          }
        }
      });
    }
  }

  ngOnInit(): void {}

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  async loginEvent(loggedIn: boolean, stepper: MatStepper) {
    if (loggedIn) {
      this.loading = true;
      const status = await firstValueFrom(this.accountService.getPaymentStatus());
      if (!status.active && this.enrollment?.school?.id && this.enrollment?.token) {
        const freeAccount = await firstValueFrom(this.enrollmentService.hasFreeEnrollment(this.enrollment?.school?.id, this.enrollment?.token));
        if (freeAccount) {
          status.active = true;
        }
      }
      
      stepper.next();
      this.loading = false;
      if (status?.active && this.enrollment?.type == EnrollmentType.STUDENT) {
        stepper.next();
      }
      if (status?.active && this.enrollment?.type == EnrollmentType.TANDEM_PILOT) {
        stepper.next();
      }
    }
  }

  validate(stepper: MatStepper) {
    if (this.token) {
      this.enrollmentService.acceptEnrollment(this.token).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: () => {
          stepper.next();
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
    const session = await firstValueFrom(this.accountService.getStripeSession(this.token));
    window.open(session.url, '_self');
  }
}
