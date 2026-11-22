import { AfterViewChecked, ChangeDetectorRef, Component, DestroyRef, ElementRef, Inject, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ThemePalette } from '@angular/material/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { Appointment } from 'src/app/shared/domain/appointment';
import { AppointmentType } from 'src/app/shared/domain/appointment-type-dto';
import { State } from 'src/app/shared/domain/state';
import { Student } from 'src/app/shared/domain/student';
import { Subscription } from 'src/app/shared/domain/subscription';
import { User } from 'src/app/shared/domain/user';
import { AppointmentsComponent } from '../../pages/appointments/appointments.component';
import { GuestSubscription } from 'src/app/shared/domain/guest-subscription';
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, skip, startWith } from 'rxjs';

@Component({
  selector: 'app-appointment-form-dialog',
  templateUrl: './appointment-form-dialog.component.html',
  styleUrls: ['./appointment-form-dialog.component.scss'],
  standalone: false
})
export class AppointmentFormDialogComponent implements OnInit, AfterViewChecked {

  form: UntypedFormGroup;
  states = Object.keys(State);
  private appointment: Appointment;
  /** Students that can be added. Empty until the page's student list has loaded. */
  students: Student[] = [];
  studentsLoaded = false;
  appointmentTypes: AppointmentType[];
  selectedStudents = new Set<string>();
  /** Users of the subscriptions the appointment already has, by email. Existing
   *  rows are shown and saved from these — never looked up in `students`, which
   *  may still be loading or not contain the subscriber (e.g. archived student). */
  private existingSubscribers = new Map<string, User>();

  /** The footer is swapped for the delete confirmation while this is set. */
  confirmingDelete = false;
  deleteMessage = '';
  // As saved, not as currently edited in the form: delete acts on the stored appointment.
  subscribedCount = 0;
  waitingCount = 0;
  guestCount = 0;
  /** Subscribers the API will notify: every subscription (waiting list included) of an upcoming appointment. */
  notifyCount = 0;
  private isUpcoming = false;

  @ViewChild('keepButton') keepButton?: ElementRef<HTMLButtonElement>;

  @ViewChildren('subscriptionFormList') subscriptionFormList?: QueryList<ElementRef>
  @ViewChildren('guestSubscriptionFormList') guestSubscriptionFormList?: QueryList<ElementRef>

  public color: ThemePalette = 'primary';

  constructor(
    private fb: UntypedFormBuilder,
    public dialogRef: MatDialogRef<AppointmentsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private cdRef: ChangeDetectorRef,
    private translate: TranslateService,
    destroyRef: DestroyRef
  ) {
    this.appointment = data.appointment;
    this.appointmentTypes = data.appointmentTypes;

    this.waitingCount = this.appointment.subscriptions.filter((subscription: Subscription) => subscription.waitingList).length;
    this.subscribedCount = this.appointment.subscriptions.length - this.waitingCount;
    this.guestCount = this.appointment.guestSubscriptions.length;
    // Same rule as the API: deleting an appointment that already took place notifies nobody.
    this.isUpcoming = !!this.appointment.scheduling && new Date(this.appointment.scheduling).getTime() > Date.now();
    this.notifyCount = this.isUpcoming ? this.appointment.subscriptions.length : 0;

    (data.students$ as Observable<Student[] | null>).pipe(takeUntilDestroyed(destroyRef)).subscribe((students: Student[] | null) => {
      this.students = students ?? [];
      this.studentsLoaded = students !== null;
    });

    const subscriptionFbArray = this.fb.array([]);
    this.appointment.subscriptions.forEach((subscription: Subscription) => {
      if (subscription.user?.email) {
        this.existingSubscribers.set(subscription.user.email, subscription.user);
      }
      subscriptionFbArray.push(this.fb.group({
        user: [subscription.user?.email, Validators.required],
        existing: [true]
      }));
    });

    const guestSubscriptionFbArray = this.fb.array([]);
    this.appointment.guestSubscriptions.forEach((guestSubscription: GuestSubscription) => {
      guestSubscriptionFbArray.push(this.fb.group({
        id: [guestSubscription.id, Validators.required],
        firstname: [guestSubscription.firstname, Validators.required],
        lastname: [guestSubscription.lastname, Validators.required]
      }));
    });

    // Extract time from scheduling date (UTC)
    const schedulingTime = this.appointment.scheduling ? 
      moment.utc(this.appointment.scheduling).format('HH:mm') : '';
    const deadlineTime = this.appointment.deadline ? 
      moment.utc(this.appointment.deadline).format('HH:mm') : '';

    this.form = this.fb.group({
      state: [this.appointment.state, Validators.required],
      type: [this.appointment.type?.id, Validators.nullValidator],
      date: [this.appointment.scheduling, Validators.required],
      time: [schedulingTime, Validators.required],
      deadline: [this.appointment.deadline, Validators.nullValidator],
      deadlineTime: [deadlineTime, Validators.nullValidator],
      meetingPoint: [this.appointment.meetingPoint, Validators.nullValidator],
      maxPeople: [this.appointment.maxPeople, Validators.nullValidator],
      instructor: [this.appointment.instructor?.email, Validators.nullValidator],
      takeOffCoordinator: [this.appointment.takeOffCoordinator?.email, Validators.nullValidator],
      takeOffCoordinatorText: [this.appointment.takeOffCoordinatorText, Validators.nullValidator],
      description: [this.appointment.description, Validators.nullValidator],
      subscriptions: subscriptionFbArray,
      guestSubscriptions: guestSubscriptionFbArray
    });
    this.selected();
  }

  ngAfterViewChecked() {
    this.cdRef.detectChanges();
  }

  ngOnInit(): void {
    // Listen for date and time changes to update deadline
    combineLatest([
      this.form.get('date')!.valueChanges.pipe(startWith(this.form.get('date')!.value)),
      this.form.get('time')!.valueChanges.pipe(startWith(this.form.get('time')!.value))
    ]).pipe(
      skip(1) // Skip the initial emission from startWith
    ).subscribe(([date, time]) => {
      this.updateDeadlineFromDateTime(date, time);
    });
  }

  isSelected(email: string | undefined) {
    if (!email) {
      return;
    }
    return this.selectedStudents.has(email);
  }

  /** Emails already in the list (existing and newly picked), hidden from the other selects. */
  selected() {
    this.selectedStudents.clear();
    // The `user` control holds the subscriber's email (a string), not a user object.
    this.subscriptions.value.forEach((row: { user: string }) => {
      if (row.user) {
        this.selectedStudents.add(row.user);
      }
    });
  }

  existingSubscriberName(email: string): string {
    const user = this.existingSubscribers.get(email);
    return `${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim() || email;
  }

  /** Only a saved appointment can be deleted. */
  get canDelete(): boolean {
    return !!this.appointment.id;
  }

  get hasParticipants(): boolean {
    return this.appointment.subscriptions.length + this.guestCount > 0;
  }

  get deleteTitle(): string {
    const scheduling = moment.utc(this.appointment.scheduling);
    // Without a type the sentence needs its own wording ("the appointment"), not a stand-in name.
    const typeName = this.appointment.type?.name;
    return this.translate.instant(typeName ? 'appointment.delete.title' : 'appointment.delete.titleNoType', {
      type: typeName,
      date: scheduling.format('DD.MM.YYYY'),
      time: scheduling.format('HH:mm')
    });
  }

  /** Who hears about the deletion. Guests have no account, so they never do. */
  get deleteConsequenceKey(): string {
    if (this.notifyCount > 0) {
      return this.guestCount > 0 ? 'appointment.delete.notifyStudentsNotGuests' : 'appointment.delete.notifyStudents';
    }
    if (!this.hasParticipants) {
      return 'appointment.delete.notifyNobodySubscribed';
    }
    return this.isUpcoming ? 'appointment.delete.notifyGuestsOnly' : 'appointment.delete.notifyNobodyPast';
  }

  askDelete(): void {
    this.deleteMessage = '';
    this.confirmingDelete = true;
    // Focus lands on the safe choice once the panel has rendered.
    setTimeout(() => this.keepButton?.nativeElement.focus(), 0);
  }

  cancelDelete(): void {
    this.confirmingDelete = false;
  }

  onDelete(): void {
    this.dialogRef.close({
      event: "delete",
      appointment: this.appointment,
      message: this.deleteMessage.trim() || undefined
    });
  }

  onCancel(): void {
    this.dialogRef.close({ event: "cancel" });
  }

  onSave(): void {
    if (!this.appointment.instructor) {
      this.appointment.instructor = new User();
    }

    if (!this.appointment.takeOffCoordinator) {
      this.appointment.takeOffCoordinator = new User();
    }

    if (!this.appointment.type) {
      this.appointment.type = new AppointmentType();
    }

    if (this.form.valid) {
      this.appointment.state = this.form.get("state")?.value;
      this.appointment.type.id = this.form.get("type")?.value;
      
      // Combine date and time for scheduling (UTC)
      const dateValue = this.form.get("date")?.value;
      const timeValue = this.form.get("time")?.value;
      if (dateValue && timeValue) {
        const [hours, minutes] = timeValue.split(':');
        const localDate = moment(dateValue);
        const combined = moment.utc({
          year: localDate.year(),
          month: localDate.month(),
          date: localDate.date(),
          hour: parseInt(hours),
          minute: parseInt(minutes),
          second: 0
        });
        this.appointment.scheduling = combined.toDate();
      } else {
        this.appointment.scheduling = dateValue;
      }
      
      // Combine date and time for deadline (UTC)
      const deadlineValue = this.form.get("deadline")?.value;
      const deadlineTimeValue = this.form.get("deadlineTime")?.value;
      if (deadlineValue && deadlineTimeValue) {
        const [hours, minutes] = deadlineTimeValue.split(':');
        const localDeadline = moment(deadlineValue);
        const combined = moment.utc({
          year: localDeadline.year(),
          month: localDeadline.month(),
          date: localDeadline.date(),
          hour: parseInt(hours),
          minute: parseInt(minutes),
          second: 0
        });
        this.appointment.deadline = combined.toDate();
      } else {
        this.appointment.deadline = deadlineValue;
      }
      this.appointment.instructor.email = this.form.get("instructor")?.value;
      this.appointment.takeOffCoordinator.email = this.form.get("takeOffCoordinator")?.value;
      this.appointment.takeOffCoordinatorText = this.form.get("takeOffCoordinatorText")?.value;
      this.appointment.maxPeople = this.form.get("maxPeople")?.value;
      this.appointment.meetingPoint = this.form.get("meetingPoint")?.value;
      this.appointment.description = this.form.get("description")?.value;

      const subscriptionList = this.form.get("subscriptions")?.value;

      this.appointment.subscriptions = [];
      subscriptionList.forEach((subscriptionUser: any) => {
        const subscription = new Subscription();
        subscription.user = this.existingSubscribers.get(subscriptionUser.user) ?? this.findUserByEmail(subscriptionUser.user);
        this.appointment.subscriptions.push(subscription);
      })

      const guestSubscriptionList = this.form.get("guestSubscriptions")?.value;
      this.appointment.guestSubscriptions = [];
      guestSubscriptionList.forEach((guestSubscriptionUser: any) => {
        const guestSubscription = new GuestSubscription();
        guestSubscription.id = guestSubscriptionUser.id;
        guestSubscription.firstname = guestSubscriptionUser.firstname;
        guestSubscription.lastname = guestSubscriptionUser.lastname;
        this.appointment.guestSubscriptions.push(guestSubscription);
      })

      this.dialogRef.close({
        event: "save",
        appointment: this.appointment
      });
    }
  }

  findUserByEmail(email: string) {
    return this.students.find((student: Student) => {
      return student.user?.email == email;
    })?.user
  }

  get subscriptions(): FormArray {
    return this.form.get("subscriptions") as FormArray
  }

  addSubscription() {
    if (!this.studentsLoaded) {
      return;
    }
    const subscriptionForm = this.fb.group({
      user: ['', Validators.required],
      existing: [false]
    });

    this.subscriptions.push(subscriptionForm);

    setTimeout(() => {
      this.subscriptionFormList?.last.nativeElement.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  removeSubscription(index: number) {
    this.subscriptions.removeAt(index);
    this.selected();
  }

  get guestSubscriptions(): FormArray {
    return this.form.get("guestSubscriptions") as FormArray
  }

  addGuestSubscription() {
    const guestSubscriptionForm = this.fb.group({
      firstname: ['', Validators.required],
      lastname: ['', Validators.required]
    });

    this.guestSubscriptions.push(guestSubscriptionForm);

    setTimeout(() => {
      this.guestSubscriptionFormList?.last.nativeElement.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  removeGuestSubscription(index: number) {
    this.guestSubscriptions.removeAt(index);
  }

  changeType(event: MatSelectChange) {
    if (!event.value) {
      return;
    }

    const type = this.appointmentTypes.find((appointmentType: AppointmentType) => appointmentType.id == event.value);
    // An empty default on the type must not wipe what is already in the form.
    if (type?.meetingPoint) {
      this.form.get("meetingPoint")?.setValue(type.meetingPoint);
    }
    if (type?.maxPeople != null) {
      this.form.get("maxPeople")?.setValue(type.maxPeople);
    }
    if (type?.instructor?.email) {
      this.form.get("instructor")?.setValue(type.instructor.email);
    }
    if (type?.time) {
      const time = moment.utc(type.time, 'HH:mm');
      this.form.get("time")?.setValue(time.format('HH:mm'));
    }
  }

  updateDeadlineFromDateTime(dateValue: Date | null, timeValue: string | null) {
    if (!dateValue || !timeValue) {
      return;
    }
    const type = this.appointmentTypes.find((appointmentType: AppointmentType) => appointmentType.id == this.form.get("type")?.value);
    if (type?.deadlineOffsetHours) {
      const [hours, minutes] = timeValue.split(':');
      // Use moment() to get local date components, then create UTC moment with those components
      const localDate = moment(dateValue);
      const schedulingDate = moment.utc({
        year: localDate.year(),
        month: localDate.month(),
        date: localDate.date(),
        hour: parseInt(hours),
        minute: parseInt(minutes),
        second: 0
      });

      const deadline = schedulingDate.subtract(type.deadlineOffsetHours, 'hours');
      this.form.get("deadline")?.setValue(deadline.toDate());
      this.form.get("deadlineTime")?.setValue(deadline.format('HH:mm'));
    } else {
      this.form.get("deadline")?.setValue(dateValue);
      this.form.get("deadlineTime")?.setValue(timeValue);
    }
  }
}
