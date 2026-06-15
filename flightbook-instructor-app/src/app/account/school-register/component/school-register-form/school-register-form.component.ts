import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { School } from 'src/app/shared/domain/school';

@Component({
    selector: 'fb-school-register-form',
    templateUrl: './school-register-form.component.html',
    styleUrls: ['./school-register-form.component.scss'],
    standalone: false
})
export class SchoolRegisterFormComponent implements OnInit, OnDestroy {

  @Input() school: School | undefined;
  @Output() saved = new EventEmitter<boolean>();

  registerInvalid = false;
  form: UntypedFormGroup;
  unsubscribe$ = new Subject<void>();

  constructor(
    private fb: UntypedFormBuilder,
    private schoolService: SchoolService,
    private accountService: AccountService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      address1: ['', Validators.required],
      address2: [''],
      plz: ['', Validators.required],
      city: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', Validators.required],
      language: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.form.setValue({
      name: this.school?.name || '',
      address1: this.school?.address1 || '',
      address2: this.school?.address2 || '',
      plz: this.school?.plz || '',
      city: this.school?.city || '',
      phone: this.school?.phone || '',
      email: this.school?.email || '',
      language: this.school?.language || ''
    })
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  onSubmit() {
    this.registerInvalid = false;
    if (this.form?.valid && this.school) {
      this.school.name = this.form.get('name')?.value;
      this.school.address1 = this.form.get('address1')?.value;
      this.school.address2 = this.form.get('address2')?.value;
      this.school.plz = this.form.get('plz')?.value;
      this.school.city = this.form.get('city')?.value;
      this.school.phone = this.form.get('phone')?.value;
      this.school.email = this.form.get('email')?.value;
      this.school.language = this.form.get('language')?.value;

      this.schoolService.createSchool(this.school).pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: async resp => {
          this.saved.emit(true);
          this.accountService.logout().pipe(takeUntil(this.unsubscribe$)).subscribe(resp => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
          });
        },
        error: async (error: any) => {
          if (error.status === 409) {
            this.registerInvalid = true;
          }
          this.saved.emit(false);
        }
      })
    }
  }

}
