import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, LoadingController, NavController, IonIcon, IonContent, IonInfiniteScroll, IonInfiniteScrollContent, AlertController } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { addIcons } from "ionicons";
import { add, checkmark, chevronBack } from 'ionicons/icons';
import { PassengerConfirmationFormComponent } from '../shared/components/passenger-confirmation-form/passenger-confirmation-form.component';
import { TandemService } from '../shared/tandem.service';
import { PassengerConfirmation } from '../shared/domain/passenger-confirmation.model';
import { PaymentService } from 'src/app/shared/services/payment.service';
import { Capacitor } from '@capacitor/core';
import { XlsxExportService } from 'src/app/shared/services/xlsx-export.service';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { TandemSchoolService } from 'src/app/school/shared/tandem-school.service';
import { LanguageService, resolveLanguage } from 'src/app/shared/services/language.service';
import { Location } from '@angular/common';
import { navigateBackOrTo } from 'src/app/shared/util/back-navigation';
import { localDate } from 'src/app/shared/util/format';

@Component({
  selector: 'app-passenger-confirmation-list',
  templateUrl: './passenger-confirmation-list.page.html',
  styleUrls: ['./passenger-confirmation-list.page.scss'],
  imports: [
    TranslateModule,
    DatePipe,
    IonIcon,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent
  ]
})
export class PassengerConfirmationListPage implements OnInit, OnDestroy {

  unsubscribe$ = new Subject<void>();
  passengerConfirmations = signal<PassengerConfirmation[]>([]);
  schools = this.tandemSchoolService.schools;
  /** LanguageService, not translate.currentLang: reactive, and always a locale Angular has data for. */
  get currentLang(): string {
    return this.languageService.lang();
  }

  /**
   * Grouped by month, as the design lists them. A single pass keeps the order
   * the endpoint returned, so infinite-scroll appends land in the right group.
   */
  public groupedConfirmations = computed(() => {
    const groups: { key: string; date: Date; confirmations: PassengerConfirmation[] }[] = [];
    for (const confirmation of this.passengerConfirmations()) {
      // localDate, not new Date(): the heading has to land in the same calendar
      // day the row's DatePipe renders, whatever zone the device is in.
      const date = localDate(confirmation.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.confirmations.push(confirmation);
      } else {
        groups.push({ key, date, confirmations: [confirmation] });
      }
    }
    return groups;
  });

  constructor(
    private route: ActivatedRoute,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private location: Location,
    private tandemService: TandemService,
    private loadingCtrl: LoadingController,
    private alertController: AlertController,
    private translate: TranslateService,
    private paymentService: PaymentService,
    private xlsxExportService: XlsxExportService,
    private tandemSchoolService: TandemSchoolService,
    private languageService: LanguageService,
    private router: Router
  ) {
    addIcons({ add, checkmark, 'chevron-back': chevronBack });
  }

  async ngOnInit() {
    await this.tandemSchoolService.getSchools();
    await this.initialDataLoad();

    /*
     * Arriving from the tab bar's add sheet. Subscribed, not read from the
     * snapshot: this page is a child of the tab shell, so triggering the sheet
     * while already standing here is a query-param-only navigation. Ionic's
     * route-reuse strategy keeps the instance, ngOnInit never re-runs, and the
     * sheet just closed with nothing happening.
     *
     * The param is cleared once handled, so the same choice works twice (the
     * router drops a navigation to a byte-identical URL) and a later
     * re-creation of the page does not pop the form unprompted.
     */
    this.route.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        if (params.get('new') !== '1') {
          return;
        }
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
        this.openAddPassengerConfirmation();
      });
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  close() {
    navigateBackOrTo(this.navCtrl, this.location, 'more');
  }

  initials(confirmation: PassengerConfirmation): string {
    return `${confirmation.firstname?.charAt(0) ?? ''}${confirmation.lastname?.charAt(0) ?? ''}`.toUpperCase();
  }

  async openAddPassengerConfirmation() {
    if (
      (!this.paymentService.getPaymentStatusValue()?.active && this.passengerConfirmations().length >= 10) ||
      (this.paymentService.getPaymentStatusValue()?.active && this.paymentService.getPaymentStatusValue()?.state == 'EXEMPTED' && this.passengerConfirmations().length >= 10)
    ) {
      const alert = await this.alertController.create({
        header: this.translate.instant('message.infotitle'),
        message: this.translate.instant('payment.premiumUpgradeRequiredTandem'),
        buttons: [{
          text: this.translate.instant('buttons.done'),
        }]
      });
      await alert.present();
      return;
    } else if (
      (!this.paymentService.getPaymentStatusValue()?.active && this.passengerConfirmations().length == 0) ||
      (this.paymentService.getPaymentStatusValue()?.active && this.paymentService.getPaymentStatusValue()?.state == 'EXEMPTED' && this.passengerConfirmations().length == 0)
    ) {
      const alert = await this.alertController.create({
        header: this.translate.instant('message.infotitle'),
        message: this.translate.instant('payment.passengerConfirmationInfo'),
        buttons: [{
          text: this.translate.instant('buttons.done'),
        }]
      });
      await alert.present();
      await alert.onDidDismiss();
    }

    const modal = await this.modalCtrl.create({
      component: PassengerConfirmationFormComponent,
      cssClass: 'passenger-confirmation-form-class',
      componentProps: {
        type: 'add',
        passengerData: new PassengerConfirmation(),
        schools: this.schools()
      }
    });

    modal.present();
    const { role } = await modal.onWillDismiss();
    if (role == "save") {
      this.savePassengerConfirmation(modal.componentProps.passengerData);
    }
    // The form lets the passenger read the waiver in their own language; this
    // puts the pilot's back. Narrowed, because an unshipped device locale (es)
    // sticks in translate.currentLang while its bundle 404s, and every
    // date:...:currentLang binding then throws NG0701. Not setLanguage(): this
    // restores a language, it does not choose one, so it must not persist.
    this.translate.use(resolveLanguage(localStorage.getItem('language') || navigator.language));
  }

  async itemTapped(passengerConfirmation: PassengerConfirmation) {
    const modal = await this.modalCtrl.create({
      component: PassengerConfirmationFormComponent,
      cssClass: 'passenger-confirmation-form-class',
      componentProps: {
        type: 'view',
        passengerData: passengerConfirmation,
        schools: this.schools()
      }
    });

    modal.present();
    const { role } = await modal.onWillDismiss();
    if (role == "delete") {
      this.deletePassengerConfirmation(modal.componentProps.passengerData);
    }
    // The form lets the passenger read the waiver in their own language; this
    // puts the pilot's back. Narrowed, because an unshipped device locale (es)
    // sticks in translate.currentLang while its bundle 404s, and every
    // date:...:currentLang binding then throws NG0701. Not setLanguage(): this
    // restores a language, it does not choose one, so it must not persist.
    this.translate.use(resolveLanguage(localStorage.getItem('language') || navigator.language));
  }

  private async initialDataLoad() {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('loading.loading')
    });
    await loading.present();

    try {
      this.passengerConfirmations.set(await firstValueFrom(
        this.tandemService.getPassengerConfirmations({ limit: this.tandemService.defaultLimit })
      ));
    } catch (error) {
      console.error('Error loading passenger confirmations', error);
    } finally {
      await loading.dismiss();
    }
  }

  loadData(event: any) {
    this.tandemService.getPassengerConfirmations({
      limit: this.tandemService.defaultLimit,
      offset: this.passengerConfirmations().length
    })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((res: PassengerConfirmation[]) => {
        event.target.complete();
        if (res.length < this.tandemService.defaultLimit) {
          event.target.disabled = true;
        }
        this.passengerConfirmations.update(current => [...current, ...res]);
      });
  }

  private async savePassengerConfirmation(passengerData: PassengerConfirmation) {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('loading.save')
    });
    await loading.present();
    this.tandemService.postPassengerConfirmations(passengerData).subscribe({
      next: (response) => {
        this.initialDataLoad();
      },
      error: (error) => {
        console.error('Error saving passenger confirmation:', error);
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  private async deletePassengerConfirmation(passengerData: PassengerConfirmation) {
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('loading.delete')
    });
    await loading.present();
    this.tandemService.deletePassengerConfirmation(passengerData.id).subscribe({
      next: (response) => {
        this.initialDataLoad();
      },
      error: (error) => {
        console.error('Error saving passenger confirmation:', error);
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  async xlsxExport() {
    const loading = await this.loadingCtrl.create({
        message: this.translate.instant('loading.loading')
    });
    loading.present();
    this.tandemService.getPassengerConfirmations().pipe(takeUntil(this.unsubscribe$)).subscribe(async (res: PassengerConfirmation[]) => {
        if (Capacitor.isNativePlatform()) {
            try {
                const data: any = await this.xlsxExportService.generatePassengerConfirmationsXlsxFile(res, { bookType: 'xlsx', type: 'base64' });
                const path = `xlsx/passenger_confirmation_export.xlsx`;

                const result = await Filesystem.writeFile({
                    path,
                    data,
                    directory: Directory.External,
                    recursive: true
                });

                await loading.dismiss();

                try {
                    await FileOpener.open({
                        filePath: result.uri,
                        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    });
                } catch (error) {
                    if (Capacitor.getPlatform() == "android") {
                        const alert = await this.alertController.create({
                            header: this.translate.instant('message.infotitle'),
                            message: this.translate.instant('message.downloadExcel'),
                            buttons: [this.translate.instant('buttons.done')]
                        });
                        await alert.present();
                    } else {
                        throw error;
                    }
                }
            } catch (e) {
                await loading.dismiss();
                const alert = await this.alertController.create({
                    header: this.translate.instant('message.infotitle'),
                    message: this.translate.instant('message.generationError'),
                    buttons: [this.translate.instant('buttons.done')]
                });
                await alert.present();
            }
        } else {
            const data: any = await this.xlsxExportService.generatePassengerConfirmationsXlsxFile(res, { bookType: 'xlsx', type: 'array' });
            await loading.dismiss();
            this.xlsxExportService.saveExcelFile(data, `passenger_confirmations_export_${Date.now()}.xlsx`);
        }
    }, async (error: any) => {
        await loading.dismiss();
    });
}

}
