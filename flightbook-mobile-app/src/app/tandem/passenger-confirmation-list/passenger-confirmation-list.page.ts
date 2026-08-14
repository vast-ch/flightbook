import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  currentLang: string;

  /**
   * Grouped by month, as the design lists them. A single pass keeps the order
   * the endpoint returned, so infinite-scroll appends land in the right group.
   */
  public groupedConfirmations = computed(() => {
    const groups: { key: string; date: Date; confirmations: PassengerConfirmation[] }[] = [];
    for (const confirmation of this.passengerConfirmations()) {
      const date = new Date(confirmation.date);
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
    private tandemService: TandemService,
    private loadingCtrl: LoadingController,
    private alertController: AlertController,
    private translate: TranslateService,
    private paymentService: PaymentService,
    private xlsxExportService: XlsxExportService,
    private tandemSchoolService: TandemSchoolService
  ) {
    this.currentLang = this.translate.currentLang;
    addIcons({ add, checkmark, 'chevron-back': chevronBack });
  }

  async ngOnInit() {
    await this.tandemSchoolService.getSchools();
    await this.initialDataLoad();

    // Arriving from the tab bar's add sheet. Opened only after the load above,
    // because the quota checks read passengerConfirmations and schools().
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.openAddPassengerConfirmation();
    }
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  close() {
    this.navCtrl.navigateBack('more');
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
    this.translate.use(localStorage.getItem('language') || navigator.language.split('-')[0]);
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
    this.translate.use(localStorage.getItem('language') || navigator.language.split('-')[0]);
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
