import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonContent, IonFooter, IonButton, IonTextarea, IonIcon, IonModal, IonDatetime, ModalController } from "@ionic/angular/standalone";
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { close, chevronForward } from 'ionicons/icons';
import { GliderCheck } from 'src/app/glider/shared/glider.model';

@Component({
  selector: 'app-check',
  templateUrl: './check.component.html',
  styleUrls: ['./check.component.scss'],
  imports: [
    IonDatetime,
    IonModal,
    TranslateModule,
    IonIcon,
    IonTextarea,
    IonButton,
    IonContent,
    IonFooter,
    DatePipe,
    FormsModule
  ]
})
export class CheckComponent {

  @Input() gliderCheck: GliderCheck;
  /** Drives the confirm button's label; the caller already knows which it is. */
  @Input() mode: 'add' | 'edit' = 'add';
  language: string;

  constructor(
    private translate: TranslateService,
    private modalCtrl: ModalController,
    private alertController: AlertController
  ) {
    this.language = this.translate.currentLang;
    addIcons({ close, 'chevron-forward': chevronForward });
  }

  closeCheckModal() {
    this.modalCtrl.dismiss(
      { type: 'close' }
    );
  }

  async saveCheck() {
    // The old template marked the date required but never bound it, so the
    // validator never ran. A check without a date is meaningless, so guard here.
    if (!this.gliderCheck?.date) {
      const alert = await this.alertController.create({
        header: this.translate.instant('message.errortitle'),
        message: this.translate.instant('message.mendatoryFields'),
        buttons: [this.translate.instant('buttons.done')]
      });
      await alert.present();
      return;
    }

    this.modalCtrl.dismiss(
      { type: 'save', gliderCheck: this.gliderCheck }
    );
  }

  changeDate(event: CustomEvent) {
    this.gliderCheck.date = event.detail.value ? new Date(event.detail.value) : new Date();
  }
}
