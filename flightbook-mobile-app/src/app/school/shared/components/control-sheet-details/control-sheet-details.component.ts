import { Component, Input, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { close } from "ionicons/icons";

@Component({
    selector: 'app-control-sheet-details',
    templateUrl: './control-sheet-details.component.html',
    styleUrls: ['./control-sheet-details.component.scss'],
    // Required: the coaching text arrives via [innerHTML], which emulated
    // encapsulation cannot reach. Keep every selector here class-scoped.
    encapsulation: ViewEncapsulation.None,
    imports: [
        TranslateModule,
        IonHeader,
        IonToolbar,
        IonTitle,
        IonButtons,
        IonButton,
        IonIcon,
        IonContent
    ]
})
export class ControlSheetDetailsComponent {

    @Input() type: string;
    @Input() key: string;

    constructor(
        private modalCtrl: ModalController,
        private sanitizer: DomSanitizer,
        private translate: TranslateService
    ) {
        addIcons({ close });
    }

    /** null for 42 of the 48 skills, so the template must check the value. */
    videoUrl(): string | null {
        const url = this.translate.instant(`controlSheet.${this.type}.${this.key}.video`);
        return url && typeof url === 'string' ? url : null;
    }

    close() {
        return this.modalCtrl.dismiss();
    }

    getSafeUrl(url: string): SafeResourceUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
}
