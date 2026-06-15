import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormGroup, FormBuilder, Validators, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface PhonePrefix {
  name: string;
  prefix: string;
  pattern: RegExp;
  placeholder: string;
}

@Component({
  selector: 'app-phone-number',
  templateUrl: './phone-number.component.html',
  styleUrls: ['./phone-number.component.scss'],
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslateModule
],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneNumberComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneNumberComponent),
      multi: true
    }
  ]
})
export class PhoneNumberComponent implements ControlValueAccessor, Validator {
  phoneForm: FormGroup;
  prefixes: PhonePrefix[];
  currentPattern: RegExp = /^[0-9\s]+$/;

  constructor(private fb: FormBuilder, private translate: TranslateService) {
    this.prefixes = [
      { name: this.translate.instant('country.switzerland'), prefix: '+41', pattern: /^[0-9]{2}\s[0-9]{3}\s[0-9]{2}\s[0-9]{2}$/, placeholder: '79 000 00 00' },
      { name: this.translate.instant('country.france'), prefix: '+33', pattern: /^[0-9\s]{9,15}$/, placeholder: '06 00 00 00 00' },
      { name: this.translate.instant('country.germany'), prefix: '+49', pattern: /^[0-9\s]{10,15}$/, placeholder: '0151 12345678' },
      { name: this.translate.instant('country.austria'), prefix: '+43', pattern: /^[0-9]{3,4}\s?[0-9]{3,7}$/, placeholder: '0664 1234567' },
      { name: this.translate.instant('country.italy'), prefix: '+39', pattern: /^[0-9]{3}\s?[0-9]{3,4}\s?[0-9]{3,4}$/, placeholder: '345 123 4567' },
      { name: this.translate.instant('country.other'), prefix: '-', pattern: /^(\+[0-9]{1,3}\s)?[0-9]{1,4}(\s[0-9]{1,5}){1,4}$/, placeholder: '' }
    ];

    this.phoneForm = this.fb.group({
      prefix: ['+41', Validators.nullValidator],
      phone: ['', [Validators.pattern(this.prefixes[0].pattern)]]
    });

    // Update pattern validation when prefix changes
    this.phoneForm.get('prefix')?.valueChanges.subscribe(prefix => {
      const selectedPrefix = this.prefixes.find(p => p.prefix === prefix);
      if (selectedPrefix) {
        this.currentPattern = selectedPrefix.pattern;
        this.phoneForm.get('phone')?.setValidators([
          Validators.pattern(selectedPrefix.pattern)
        ]);
        this.phoneForm.get('phone')?.updateValueAndValidity();
      }
    });

    this.phoneForm.valueChanges.subscribe(value => {
      if (value.prefix === '-') {
        this.onChange(value.phone);
      } else {
        this.onChange(value.prefix + ' ' + value.phone);
      }
    });
  }

  // ControlValueAccessor implementation
  onChange: any = () => {};
  onTouch: any = () => {};

  writeValue(value: string): void {
    if (value) {
      const prefix = this.prefixes.find(p => value.startsWith(p.prefix));
      if (prefix) {
        const phone = value.substring(prefix.prefix.length).trim();
        this.phoneForm.patchValue({
          prefix: prefix.prefix,
          phone: phone
        }, { emitEvent: false });
      } else {
        // If no matching prefix found, use "other" option
        this.phoneForm.patchValue({
          prefix: '-',
          phone: value
        }, { emitEvent: false });
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.phoneForm.disable();
    } else {
      this.phoneForm.enable();
    }
  }

  getPlaceholder(): string {
    const prefix = this.prefixes.find(p => p.prefix === this.phoneForm.get('prefix')?.value);
    return prefix?.placeholder || '';
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null; // No validation if empty
    
    const prefix = this.prefixes.find(p => control.value.startsWith(p.prefix));
    if (!prefix) return null; // No validation if prefix not found
    
    const phoneNumber = control.value.substring(prefix.prefix.length).trim();
    if (!prefix.pattern.test(phoneNumber)) {
      return { 'phoneFormat': { value: control.value } };
    }
    
    return null;
  }
}
