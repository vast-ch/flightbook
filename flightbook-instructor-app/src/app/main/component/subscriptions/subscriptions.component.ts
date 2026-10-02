import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Appointment } from 'src/app/shared/domain/appointment';
import { Subscription } from 'src/app/shared/domain/subscription';

@Component({
    selector: 'app-subscriptions',
    templateUrl: './subscriptions.component.html',
    styleUrls: ['./subscriptions.component.scss'],
    standalone: false
})
export class SubscriptionsComponent implements OnInit {

  appointment: Appointment;
  subscribed: Subscription[] = [];
  waitingList: Subscription[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.appointment = data.appointment;
    if (this.appointment.maxPeople) {
      this.appointment.subscriptions.forEach((subscription: Subscription) => {
        if (subscription.waitingList) {
          this.waitingList.push(subscription);
        } else {
          this.subscribed.push(subscription);
        }
      })
    } else {
      this.subscribed = this.appointment.subscriptions;
    }
  }

  ngOnInit(): void {
  }

}
