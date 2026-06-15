import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl, ValidationErrors, FormControl, ReactiveFormsModule } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedModule } from 'src/app/shared/shared.module';

interface PasswordForm {
  oldPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-password',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    SharedModule
]
})
export class PasswordComponent implements OnInit {
  passwordForm: FormGroup<PasswordForm>;
  submitted = false;
  hideOldPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  constructor(
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private dialogRef: MatDialogRef<PasswordComponent>,
    private translate: TranslateService,
    private snackBar: MatSnackBar
  ) {
    this.passwordForm = this.formBuilder.nonNullable.group({
      oldPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });

    // Add form-level validation for password match
    this.passwordForm.valueChanges.subscribe(() => {
      const newPassword = this.formControls.newPassword.value;
      const confirmPassword = this.formControls.confirmPassword.value;

      if (newPassword !== confirmPassword) {
        this.formControls.confirmPassword.setErrors({ ...this.formControls.confirmPassword.errors, mismatch: true });
      } else {
        const errors = { ...this.formControls.confirmPassword.errors };
        if (errors) {
          delete errors['mismatch'];
          this.formControls.confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
    });
  }

  ngOnInit(): void {}

  get formControls() {
    return this.passwordForm.controls;
  }

  onSubmit() {
    this.submitted = true;

    if (this.passwordForm.invalid) {
      return;
    }

    const passwordData = {
      oldPassword: this.formControls.oldPassword.value,
      newPassword: this.formControls.newPassword.value
    };

    this.accountService.updatePassword(passwordData).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('password.success.changed'), this.translate.instant('buttons.done'), {
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
        this.dialogRef.close();
      },
      error: (e) => {
        if (e.status === 403) {
          this.snackBar.open(this.translate.instant('password.errors.oldPasswordInvalid'), this.translate.instant('buttons.done'), {
            horizontalPosition: 'center',
            verticalPosition: 'top',
          });
        }
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
