import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DeviceSizeService } from './core/services/device-size.service';
import * as moment from 'moment';
// import 'moment/locale/de'
 
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: false
})
export class AppComponent {

  constructor(private translate: TranslateService, private devicesSizeService: DeviceSizeService) {
    const defaultLang = 'de';
    this.translate.addLangs(['de', 'fr']);
    this.translate.setDefaultLang(defaultLang);
    const browserLang = localStorage.getItem('language') || navigator.language.split('-')[0];
    if (this.translate.getLangs().includes(browserLang)) {
      this.translate.use(browserLang);
    } else {
      this.translate.use(defaultLang);
    }
    moment.updateLocale('en', {
      week: {
        dow: 1,
      },
    })
  }
}
