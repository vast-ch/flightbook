import { Component } from '@angular/core';
import { ModalController, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { homeOutline, ellipsisHorizontal, add, statsChart } from 'ionicons/icons';
import { AddSheetComponent } from './add-sheet/add-sheet.component';

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
        private modalCtrl: ModalController
    ) {
        addIcons({ homeOutline, ellipsisHorizontal, add, statsChart, 'flight': 'assets/custom-ion-icons/flight.svg' });
    }

    /**
     * The centre button is not a tab - it opens the "what do you want to add"
     * sheet from the design instead of routing anywhere itself.
     */
    async openAddSheet() {
        const modal = await this.modalCtrl.create({
            component: AddSheetComponent,
            cssClass: 'fb-add-sheet'
        });
        await modal.present();
    }
}
