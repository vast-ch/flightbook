import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { AccountService } from '../../core/services/account.service';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { EmailDialogComponent } from 'src/app/main/component/email-dialog/email-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'fb-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit, OnDestroy {
  @Input() loginPageRedirect: boolean = true;
  @Input() showLanguage: boolean = true;
  @Input() email: string | undefined;

  @Output() loginEvent = new EventEmitter<boolean>();

  unsubscribe$ = new Subject<void>();

  form: UntypedFormGroup;
  loginInvalid = false;

  constructor(
    private fb: UntypedFormBuilder,
    private router: Router,
    private accountService: AccountService,
    private translate: TranslateService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    if (!this.email) {
      this.email = '';
    }
    this.form = this.fb.group({
      email: [this.email, Validators.email],
      password: ['', Validators.required]
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    this.form.setValue({ email: this.email, password: '' })
    if (this.email) {
      this.form.controls["email"].disable();
    }
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  async onSubmit(): Promise<void> {
    this.loginInvalid = false;
    if (this.form.valid) {
      const loginData = {
        email: this.form.get('email')?.value,
        password: this.form.get('password')?.value
      };

      this.accountService.login(loginData).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: async resp => {
          localStorage.setItem('access_token', resp.access_token);
          localStorage.setItem('refresh_token', resp.refresh_token);
          if (this.loginPageRedirect) {
            this.router.navigate(['']);
          }
          this.loginEvent.emit(true);
        },
        error: async (error: any) => {
          if (error.status === 401) {
            this.loginInvalid = true;
          }
          this.loginEvent.emit(false);
        }
      })
    }
  }

  setLanguage(lang: string) {
    localStorage.setItem('language', lang);
    this.translate.use(lang);
  }

  async forgotPassword() {
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      data: {
        title: this.translate.instant('login.passwordlost')
      },
      width: "500px"
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response?.event === "send") {
        this.accountService.resetPassword(response.value).pipe(takeUntil(this.unsubscribe$)).subscribe((resp: any) => {
          this.snackBar.open(this.translate.instant('formMessage.requestSent'), this.translate.instant('buttons.done'), {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
          });
        });
      }
    });
  }
}
