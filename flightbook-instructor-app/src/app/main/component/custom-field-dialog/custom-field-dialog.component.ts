import { Component, Inject, OnInit } from '@angular/core';
import { FormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CustomFieldDefinition } from 'src/app/shared/domain/school-config';

@Component({
  selector: 'app-custom-field-dialog',
  templateUrl: './custom-field-dialog.component.html',
  styleUrls: ['./custom-field-dialog.component.scss'],
  standalone: false
})
export class CustomFieldDialogComponent implements OnInit {

  form: UntypedFormGroup;
  title: string;
  customField: CustomFieldDefinition;
  isNew: boolean;

  fieldTypes = [
    { value: 'text', label: 'tandemConfig.types.text' },
    { value: 'number', label: 'tandemConfig.types.number' },
    { value: 'date', label: 'tandemConfig.types.date' },
    { value: 'boolean', label: 'tandemConfig.types.boolean' },
    { value: 'dropdown', label: 'tandemConfig.types.dropdown' }
  ];

  constructor(
    private fb: UntypedFormBuilder,
    public dialogRef: MatDialogRef<CustomFieldDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.title = data.title;
    this.customField = data.field;
    this.isNew = data.isNew;

    // Create FormArray from existing options only if type is dropdown
    const optionsArray = this.fb.array(
      this.customField.type === 'dropdown' && this.customField.options && this.customField.options.length > 0
        ? this.customField.options.map(opt => this.fb.control(opt, Validators.required))
        : []
    );

    this.form = this.fb.group({
      label: [this.customField.label, Validators.required],
      type: [this.customField.type, Validators.required],
      required: [this.customField.required],
      disabled: [this.customField.disabled],
      options: optionsArray
    });
  }

  ngOnInit(): void {
    // Watch for type changes to manage options
    this.form.get('type')?.valueChanges.subscribe(type => {
      if (type === 'dropdown') {
        // Ensure at least one option exists
        if (this.options.length === 0) {
          this.addOption();
        }
      } else {
        // Clear all options when switching away from dropdown
        while (this.options.length > 0) {
          this.options.removeAt(0);
        }
      }
    });

    // Initialize with one option if type is already dropdown
    if (this.customField.type === 'dropdown' && this.options.length === 0) {
      this.addOption();
    }
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  get showOptionsField(): boolean {
    return this.form.get('type')?.value === 'dropdown';
  }

  addOption() {
    this.options.push(this.fb.control('', Validators.required));
  }

  removeOption(index: number) {
    // Keep at least one option
    if (this.options.length > 1) {
      this.options.removeAt(index);
    }
  }

  onCancel() {
    this.dialogRef.close({ event: 'cancel' });
  }

  onSave() {
    if (this.form.valid) {
      this.customField.label = this.form.get('label')?.value;
      this.customField.type = this.form.get('type')?.value;
      this.customField.required = this.form.get('required')?.value;
      this.customField.disabled = this.form.get('disabled')?.value;

      // Convert FormArray to options array
      if (this.customField.type === 'dropdown') {
        this.customField.options = this.options.controls
          .map(control => control.value?.trim())
          .filter((opt: string) => opt && opt.length > 0);
      } else {
        this.customField.options = undefined;
      }

      // Generate UUID for new fields
      if (this.isNew) {
        this.customField.key = crypto.randomUUID();
      }

      this.dialogRef.close({
        event: 'save',
        value: this.customField
      });
    }
  }
}
