import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonInput, IonButtons, IonContent, IonItem, IonButton, IonIcon, IonSelect, IonSelectOption, IonToggle, ModalController, IonText, IonLabel } from "@ionic/angular/standalone";
import { TranslateModule } from '@ngx-translate/core';
import { CustomFieldDefinition, CustomFieldType } from 'src/app/shared/domain/custom-field.model';
import { addIcons } from 'ionicons';
import { add, close, trash } from 'ionicons/icons';

@Component({
  selector: 'app-custom-field',
  templateUrl: './custom-field.component.html',
  styleUrls: ['./custom-field.component.scss'],
  imports: [IonText,
    TranslateModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonItem,
    IonContent,
    IonButtons,
    IonInput,
    IonTitle,
    IonToolbar,
    IonHeader,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonLabel
  ]
})
export class CustomFieldComponent implements OnInit {

  @Input() field: CustomFieldDefinition;
  @Input() isNew: boolean = true;

  fieldTypes = Object.values(CustomFieldType);
  options: string[] = [''];

  constructor(
    private modalCtrl: ModalController
  ) {
    addIcons({ add, close, trash });
  }

  ngOnInit() {
    if (this.field?.options?.length > 0) {
      this.options = [...this.field.options];
    }
  }

  isDropdown(): boolean {
    return this.field.type === CustomFieldType.DROPDOWN;
  }

  onLabelChange() {
    // Key generation is now done on save for new fields
  }

  isValid(): boolean {
    if (!this.field.label || !this.field.type) {
      return false;
    }
    // Key is not required for new fields as it's generated on save
    if (!this.isNew && !this.field.key) {
      return false;
    }
    if (this.isDropdown() && this.getValidOptions().length === 0) {
      return false;
    }
    return true;
  }

  addOption() {
    this.options.push('');
  }

  removeOption(index: number) {
    this.options.splice(index, 1);
  }

  closeModal() {
    this.modalCtrl.dismiss(
      { type: 'close' }
    );
  }

  saveField() {
    if (this.isDropdown()) {
      this.field.options = this.getValidOptions();
    } else {
      delete this.field.options;
    }
    
    // Generate UUID for new fields
    if (this.isNew) {
      this.field.key = crypto.randomUUID();
    }
    
    this.modalCtrl.dismiss(
      { type: 'save', field: this.field }
    );
  }

  private getValidOptions(): string[] {
    return this.options
      .map(option => option.trim())
      .filter(option => option !== '');
  }
}
