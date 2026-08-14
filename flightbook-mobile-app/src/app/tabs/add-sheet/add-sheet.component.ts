import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';

/**
 * The sheet behind the tab bar's centre button. A modal rather than an
 * ActionSheet because the design's rows carry an icon tile, a title and a
 * subtitle, which ActionSheet buttons cannot express.
 */
@Component({
    selector: 'app-add-sheet',
    templateUrl: './add-sheet.component.html',
    styleUrls: ['./add-sheet.component.scss'],
    imports: [TranslateModule, IonIcon]
})
export class AddSheetComponent {
    private modalCtrl = inject(ModalController);
    private router = inject(Router);

    constructor() {
        addIcons({
            'chevron-forward': chevronForward,
            'flight': 'assets/custom-ion-icons/flight.svg',
            'tandem': 'assets/custom-ion-icons/tandem.svg'
        });
    }

    dismiss() {
        return this.modalCtrl.dismiss();
    }

    async logFlight() {
        await this.dismiss();
        this.router.navigate(['flights/add']);
    }

    /**
     * The briefing form lives on the confirmations list, which owns the quota
     * checks and the save; `new=1` tells it to open that form on arrival.
     */
    async tandemConfirmation() {
        await this.dismiss();
        this.router.navigate(['passenger-confirmations'], { queryParams: { new: 1 } });
    }
}
