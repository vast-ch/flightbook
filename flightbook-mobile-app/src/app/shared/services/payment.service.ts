import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PaymentStatus } from 'src/app/account/shared/paymentStatus.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private paymentStatus$: BehaviorSubject<PaymentStatus>;

  constructor() {
    this.paymentStatus$ = new BehaviorSubject(null);
  }

  getPaymentStatusValue(): PaymentStatus {
    return this.paymentStatus$.getValue();
  }

  getPaymentStatus(): Observable<PaymentStatus> {
    return this.paymentStatus$.asObservable();
  }

  setPaymentStatus(nextState: PaymentStatus): void {
    this.paymentStatus$.next(nextState);
  }

  /**
   * Entitlements belong to the account that signed in, so they go with the
   * session. Left behind, the previous pilot's premium status waved the next
   * one past the free-tier flight and confirmation limits until the refresh
   * landed - and stayed if that request failed.
   */
  clear(): void {
    this.paymentStatus$.next(null);
  }
}
