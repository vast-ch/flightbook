import { Component, Inject, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { School } from 'src/app/shared/domain/school';
import { State } from 'src/app/shared/domain/state';
import { AccountService } from 'src/app/core/services/account.service';
import { firstValueFrom } from 'rxjs';
import { InstructorExportPDFService } from 'src/app/core/services/instructor-export-pdf.service';
import { TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'fb-instructor-export',
    templateUrl: './instructor-export.component.html',
    styleUrls: ['./instructor-export.component.scss'],
    standalone: false
})
export class InstructorExportComponent implements OnInit {
    schools: School[] = [];
    states = Object.values(State);
    form: UntypedFormGroup;

    constructor(
        private fb: UntypedFormBuilder,
        public dialogRef: MatDialogRef<InstructorExportComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private accountService: AccountService,
        private instructorExportPDFService: InstructorExportPDFService,
        private translate: TranslateService,
        private snackBar: MatSnackBar
    ) {
        this.schools = data?.schools || [];
        
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        this.form = this.fb.group({
            school: [''],
            state: [''],
            startDate: [firstDayOfMonth, Validators.required],
            endDate: [lastDayOfMonth, Validators.required]
        });
    }

    ngOnInit(): void {
    }

    onCancel(): void {
        this.dialogRef.close({ event: "cancel" });
    }

    async onExport(): Promise<void> {
        if (this.form.valid) {
            const startDate = this.form.get('startDate')?.value;
            const endDate = this.form.get('endDate')?.value;
            const state = this.form.get('state')?.value || undefined;
            const schoolId = this.form.get('school')?.value || undefined;
            const appointments = await firstValueFrom(this.accountService.getAppointmentsByUserId(startDate, endDate, state, schoolId));
            if (appointments?.itemCount === 0) {
                this.snackBar.open(this.translate.instant('appointmentExport.noData'), this.translate.instant('buttons.done'), {
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                    duration: 3000
                });
                return;
            }
            const currentUser = await firstValueFrom(this.accountService.currentUser());
            const pdf = await this.instructorExportPDFService.generateAppointmentExportPdf(currentUser, appointments.entity, startDate, endDate);
            try {
            pdf.open();
            } catch (error: any) {
            pdf.download(`Appointment-export.pdf`);
            this.snackBar.open(this.translate.instant('message.pdfDownloaded'), this.translate.instant('buttons.done'), {
                horizontalPosition: 'center',
                verticalPosition: 'top',
            });
            }
            this.dialogRef.close({
                event: "export",
                value: this.form.value
            });
        }
    }
}
