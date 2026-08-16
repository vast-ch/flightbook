import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronForward } from 'ionicons/icons';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { PaymentService } from 'src/app/shared/services/payment.service';

/** Flights a free account may log before the paywall. */
const FREE_FLIGHT_LIMIT = 25;

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
    private alertController = inject(AlertController);
    private translate = inject(TranslateService);
    private flightStore = inject(FlightStore);
    private paymentService = inject(PaymentService);

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

    /**
     * The free-tier limit is checked here because this sheet is now the only way
     * into the add form - the flight list's own button, which used to hold this
     * gate, is gone with the redesigned header.
     */
    async logFlight() {
        await this.dismiss();

        if (!this.paymentService.getPaymentStatusValue()?.active
            && this.flightStore.flights().length >= FREE_FLIGHT_LIMIT) {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('payment.premiumUpgradeRequired'),
                buttons: [this.translate.instant('buttons.done')]
            });
            await alert.present();
            return;
        }

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
