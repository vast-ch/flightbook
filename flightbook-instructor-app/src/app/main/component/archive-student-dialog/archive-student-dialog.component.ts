import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'fb-archive-student-dialog',
  templateUrl: './archive-student-dialog.component.html',
  styleUrls: ['./archive-student-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSlideToggleModule,
    TranslateModule
  ]
})
export class ArchiveStudentDialogComponent {
  studentName: string;
  isAppointmentActive: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ArchiveStudentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.studentName = data.studentName;
  }

  onCancel(): void {
    this.dialogRef.close({ event: "cancel" });
  }

  onConfirm(): void {
    this.dialogRef.close({
      event: "confirm",
      isAppointmentActive: this.isAppointmentActive
    });
  }
}
