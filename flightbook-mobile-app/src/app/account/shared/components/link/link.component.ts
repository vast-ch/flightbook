import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonInput, IonContent, IonButton, IonIcon, ModalController } from "@ionic/angular/standalone";
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { Link } from '../../userConfig.model';

@Component({
  selector: 'app-link',
  templateUrl: './link.component.html',
  styleUrls: ['./link.component.scss'],
  imports: [
    TranslateModule,
    FormsModule,
    IonIcon,
    IonButton,
    IonContent,
    IonInput
  ]
})
export class LinkComponent {

  @Input() link: Link;

  /** Only decides the button's wording; the caller owns what happens after. */
  @Input() type: 'add' | 'edit' = 'add';

  constructor(
    private modalCtrl: ModalController
  ) {
    addIcons({ close });
  }

  closeLinkModal() {
    this.modalCtrl.dismiss(
      { type: 'close' }
    );
  }

  saveLink() {
    this.modalCtrl.dismiss(
      { type: 'save', link: this.link }
    );
  }
}
