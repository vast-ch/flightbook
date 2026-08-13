import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, MenuController, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { homeOutline, ellipsisHorizontal, add, statsChart } from 'ionicons/icons';

@Component({
    selector: 'app-tabs',
    templateUrl: './tabs.page.html',
    styleUrls: ['./tabs.page.scss'],
    imports: [
        TranslateModule,
        IonTabs,
        IonTabBar,
        IonTabButton,
        IonIcon,
        IonLabel
    ]
})
export class TabsPage {

    constructor(
        private router: Router,
        private menuCtrl: MenuController,
        private actionSheetCtrl: ActionSheetController,
        private translate: TranslateService
    ) {
        addIcons({ homeOutline, ellipsisHorizontal, add, statsChart, 'flight': 'assets/custom-ion-icons/flight.svg' });
    }

    /**
     * The centre button is not a tab - it opens the "what do you want to add"
     * sheet from the design instead of routing anywhere itself.
     */
    async openAddSheet() {
        const sheet = await this.actionSheetCtrl.create({
            cssClass: 'fb-add-sheet',
            buttons: [
                {
                    text: this.translate.instant('buttons.logFlight'),
                    handler: () => { this.router.navigate(['flights/add']); }
                },
                {
                    text: this.translate.instant('buttons.pasengerConfirmations'),
                    handler: () => { this.router.navigate(['passenger-confirmations']); }
                },
                {
                    text: this.translate.instant('buttons.cancel'),
                    role: 'cancel'
                }
            ]
        });
        await sheet.present();
    }

    // Until the More page exists, this tab surfaces the existing side menu so
    // nothing that used to live there becomes unreachable.
    openMore() {
        this.menuCtrl.open();
    }
}
