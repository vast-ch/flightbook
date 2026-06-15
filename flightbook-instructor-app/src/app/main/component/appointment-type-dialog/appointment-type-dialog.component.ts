import { Component, Inject, Input, OnInit } from '@angular/core';
import { FormControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppointmentType } from 'src/app/shared/domain/appointment-type-dto';
import { User } from 'src/app/shared/domain/user';

@Component({
    selector: 'app-appointment-type-dialog',
    templateUrl: './appointment-type-dialog.component.html',
    styleUrls: ['./appointment-type-dialog.component.scss'],
    standalone: false
})
export class AppointmentTypeDialogComponent implements OnInit {

  form: UntypedFormGroup;
  title: string;
  appointmentType: AppointmentType;

  constructor(
    private fb: UntypedFormBuilder,
    public dialogRef: MatDialogRef<AppointmentTypeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {
      this.title = data.title;
      this.appointmentType = data.type;
      // Convert deadlineOffsetHours to days and hours
      const totalHours = this.appointmentType.deadlineOffsetHours || 0;
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;

      this.form = this.fb.group({
        name: [this.appointmentType.name, Validators.required],
        meetingPoint: [this.appointmentType.meetingPoint, Validators.nullValidator],
        maxPeople: [this.appointmentType.maxPeople, Validators.nullValidator],
        color: [this.appointmentType.color || "#3880ff", Validators.nullValidator],
        instructor: [this.appointmentType.instructor?.email, Validators.nullValidator],
        time: [this.appointmentType.time, Validators.nullValidator],
        deadlineDays: [days > 0 ? days : null, Validators.nullValidator],
        deadlineHours: [hours > 0 ? hours : null, Validators.nullValidator],
      });
    }

  ngOnInit(): void {}

  onCancel() {
    this.dialogRef.close({ event: "cancel" });
  }

  onSave() {
    if (this.form.valid) {

      if (!this.appointmentType.instructor) {
        this.appointmentType.instructor = new User();
      }

      this.appointmentType.name = this.form.get('name')?.value
      this.appointmentType.meetingPoint = this.form.get('meetingPoint')?.value
      this.appointmentType.maxPeople = this.form.get('maxPeople')?.value
      this.appointmentType.color = this.form.get('color')?.value
      const time = this.form.get('time')?.value;
      if (time === "") {
        this.appointmentType.time = undefined;
      } else {
        this.appointmentType.time = time;
      }
      // Convert days and hours back to total hours
      const days = this.form.get('deadlineDays')?.value || 0;
      const hours = this.form.get('deadlineHours')?.value || 0;
      const totalHours = (days * 24) + hours;
      this.appointmentType.deadlineOffsetHours = totalHours > 0 ? totalHours : null
      this.appointmentType.instructor.email = this.form.get("instructor")?.value;

      this.dialogRef.close({
        event: "save",
        value: this.appointmentType
      });
    }
  }

}
