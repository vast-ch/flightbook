import { Component, EventEmitter, OnDestroy, OnInit, Output, Signal } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { AccountService } from 'src/app/core/services/account.service';
import { DeviceSizeService } from 'src/app/core/services/device-size.service';
import { SchoolService } from 'src/app/core/services/school.service';
import { CustomFieldDefinition, FlightConfig } from 'src/app/shared/domain/school-config';
import { School } from 'src/app/shared/domain/school';
import { CustomFieldDialogComponent } from '../custom-field-dialog/custom-field-dialog.component';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'fb-tandem-config',
  templateUrl: './tandem-config.component.html',
  styleUrls: ['./tandem-config.component.scss'],
  standalone: false
})
export class TandemConfigComponent implements OnInit, OnDestroy {

  @Output() backButtonClick = new EventEmitter();

  color: ThemePalette = 'primary';
  school?: School;
  customFields: CustomFieldDefinition[] = [];
  displayedColumns: string[] = ['label', 'type', 'disabled', 'edit'];

  get isMobile(): Signal<boolean> {
    return this.deviceSize.isMobile;
  }

  unsubscribe$ = new Subject<void>();

  constructor(
    private schoolService: SchoolService,
    private accountService: AccountService,
    private dialog: MatDialog,
    private deviceSize: DeviceSizeService
  ) {}

  ngOnInit(): void {
    this.school = this.accountService.currentSelectedSchool;
    if (this.school) {
      this.loadCustomFields();
    }

    this.accountService.changeSelectedSchool$.pipe(takeUntil(this.unsubscribe$)).subscribe((school: School) => {
      this.school = school;
      this.loadCustomFields();
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  loadCustomFields() {
    if (this.school?.configuration?.tandemModule?.flightConfig?.customFields) {
      this.customFields = [...this.school.configuration.tandemModule.flightConfig.customFields];
    } else {
      this.customFields = [];
    }
  }

  openCustomFieldForm(field?: CustomFieldDefinition) {
    let isNew = false;
    if (!field) {
      field = {
        key: '',
        label: '',
        type: 'text',
        required: false,
        disabled: false
      };
      isNew = true;
    }

    const dialogRef = this.dialog.open(CustomFieldDialogComponent, {
      data: {
        title: isNew ? 'tandemConfig.addField' : 'tandemConfig.editField',
        field: { ...field },
        isNew: isNew
      },
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(response => {
      if (response?.event === 'save') {
        if (isNew) {
          this.addCustomField(response.value);
        } else {
          this.updateCustomField(response.value);
        }
      }
    });
  }

  addCustomField(field: CustomFieldDefinition) {
    this.customFields.push(field);
    this.saveConfiguration();
  }

  async updateCustomField(updatedField: CustomFieldDefinition) {
    const index = this.customFields.findIndex(f => f.key === updatedField.key);
    if (index >= 0) {
      this.customFields[index] = updatedField;
      await this.saveConfiguration();
    }
  }

  async toggleDisabled(event: MatSlideToggleChange, field: CustomFieldDefinition) {
    field.disabled = event.checked;
    await this.updateCustomField(field);
  }

  async saveConfiguration() {
    if (!this.school?.id || !this.school.configuration) {
      return;
    }

    // Ensure tandemModule exists
    if (!this.school.configuration.tandemModule) {
      this.school.configuration.tandemModule = { active: true };
    }

    // Ensure flightConfig exists
    if (!this.school.configuration.tandemModule.flightConfig) {
      this.school.configuration.tandemModule.flightConfig = { customFields: [] };
    }

    // Update custom fields
    this.school.configuration.tandemModule.flightConfig.customFields = [...this.customFields];

    try {
      await firstValueFrom(
        this.schoolService.updateSchoolConfiguration(this.school.id, this.school.configuration)
      );
      this.loadCustomFields();
    } catch (error) {
      console.error('Failed to save custom fields configuration:', error);
    }
  }

  getFieldTypeLabel(type: string): string {
    return `tandemConfig.types.${type}`;
  }

  drop(event: CdkDragDrop<CustomFieldDefinition[]>) {
    moveItemInArray(this.customFields, event.previousIndex, event.currentIndex);
    this.saveConfiguration();
  }

  backButton() {
    this.backButtonClick.emit();
  }
}
