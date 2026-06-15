import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { User } from 'src/app/shared/domain/user';

@Component({
    selector: 'fb-user-register',
    templateUrl: './user-register.component.html',
    styleUrls: ['./user-register.component.scss'],
    standalone: false
})
export class UserRegisterComponent implements OnInit, OnDestroy {
  @Input() email: string | undefined;

  @Output() loginEvent = new EventEmitter<boolean>();

  unsubscribe$ = new Subject<void>();

  form: UntypedFormGroup;
  registerInvalid = false;

  constructor(
    private fb: UntypedFormBuilder,
    private accountService: AccountService
  ) {
    this.form = this.fb.group({
      firstname: ['', Validators.required],
      lastname: ['', Validators.required],
      email: [this.email, Validators.email],
      password: ['', Validators.required],
      phone: ['', Validators.nullValidator]
    });
  }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    this.form.setValue({
      firstname: '',
      lastname: '',
      email: this.email,
      password: '',
      phone: ''
    })

    if (this.email) {
      this.form.controls["email"].disable();
    }
  }

  onSubmit() {
    this.registerInvalid = false;
    if (this.form.valid) {
      const user = new User();
      user.email = this.form.get('email')?.value;
      user.firstname = this.form.get('firstname')?.value;
      user.lastname = this.form.get('lastname')?.value;
      user.password = this.form.get('password')?.value;
      user.phone = this.form.get('phone')?.value || null;

      const loginData = {
        email: this.form.get('email')?.value,
        password: this.form.get('password')?.value
      };

      this.accountService.register(user).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: async resp => {
          this.accountService.login(loginData).pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: async resp => {
              localStorage.setItem('access_token', resp.access_token);
              localStorage.setItem('refresh_token', resp.refresh_token);
              this.loginEvent.emit(true);
            }
          })
        },
        error: async (error: any) => {
          if (error.status === 409) {
            this.registerInvalid = true;
          }
          this.loginEvent.emit(false);
        }
      })
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

}
