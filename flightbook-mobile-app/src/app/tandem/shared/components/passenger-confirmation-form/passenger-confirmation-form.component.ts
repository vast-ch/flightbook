import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActionSheetController, IonButton, IonContent, IonIcon, IonInput, IonToggle, ModalController, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { chevronForward, close } from 'ionicons/icons';
import { Subject } from 'rxjs';
import SignaturePad from 'signature_pad';
import { PassengerConfirmation } from '../../domain/passenger-confirmation.model';
import { ColorService } from 'src/app/shared/services/color.service';
import { School } from 'src/app/school/shared/school.model';

/** The languages a passenger can be handed the declaration in. */
const LANGUAGES = ['de', 'fr', 'it', 'en'];

@Component({
  selector: 'app-passenger-confirmation-form',
  templateUrl: './passenger-confirmation-form.component.html',
  styleUrl: './passenger-confirmation-form.component.scss',
  imports: [
    FormsModule,
    DatePipe,
    TranslateModule,
    IonButton,
    IonIcon,
    IonContent,
    IonInput,
    IonToggle,
    IonSelect,
    IonSelectOption
  ]
})
export class PassengerConfirmationFormComponent implements OnDestroy {
  unsubscribe$ = new Subject<void>();

  /**
   * Always supplied through componentProps, which replaces this - but the
   * template reads it before that would help if a caller ever forgot.
   */
  passengerData: PassengerConfirmation = new PassengerConfirmation();
  schools: School[] = [];
  type: 'add' | 'view';

  /** Details, then signature - as the design's step indicator has it. */
  public step = signal<1 | 2>(1);

  signaturePad!: SignaturePad;

  /** The element the current pad is bound to, so a re-created canvas rebinds. */
  private signatureCanvasElement?: HTMLCanvasElement;

  /**
   * A setter, not a plain @ViewChild: the canvas only enters the DOM when the
   * signature step opens, which is after ngAfterViewInit has already run.
   *
   * Compared by element, not by "do we have a pad": the canvas lives inside
   * @if (step() === 2 || isView), so stepping back to the details and forward
   * again destroys it and builds a new one. Skipping that rebind left the pad
   * listening to a detached canvas - the visible one took no strokes, while
   * isEmpty() and toDataURL() still answered from the old one.
   */
  @ViewChild('signatureCanvas') set signatureCanvas(element: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = element?.nativeElement;
    if (!canvas || canvas === this.signatureCanvasElement) {
      return;
    }
    // Carry the stroke across the round trip, and release the old canvas.
    const previous = this.signaturePad && !this.signaturePad.isEmpty()
      ? this.signaturePad.toDataURL()
      : null;
    this.signaturePad?.off();
    this.signatureCanvasElement = canvas;
    // Next frame, so the canvas has been laid out and can be measured - and so
    // this lands outside the change-detection pass that created it.
    cancelAnimationFrame(this.signatureFrame);
    this.signatureFrame = requestAnimationFrame(() => this.initSignaturePad(canvas, previous));
  }

  /** Pending signature-pad init, cancelled on destroy. */
  private signatureFrame = 0;

  constructor(
    private modalController: ModalController,
    private translate: TranslateService,
    private colorService: ColorService,
    private actionSheetCtrl: ActionSheetController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ close, chevronForward });
  }

  ngOnDestroy() {
    // The pending frame outlives the view otherwise, and initSignaturePad
    // ends in detectChanges() - NG0911 on a destroyed view if the sheet was
    // dragged shut inside the same frame that revealed the canvas.
    cancelAnimationFrame(this.signatureFrame);
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  // ---- View state -----------------------------------------------------

  get isView(): boolean {
    return this.type === 'view';
  }

  get languageCode(): string {
    return (this.translate.currentLang || this.translate.getDefaultLang() || '').toUpperCase();
  }

  /** Everything the passenger has to give before they can sign. */
  detailsComplete(form: NgForm): boolean {
    return !!form?.valid && !!this.passengerData?.validated;
  }

  async openLanguagePicker() {
    const sheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('login.language'),
      buttons: [
        ...LANGUAGES.map(lang => ({
          text: this.translate.instant(`language.${lang}`),
          handler: () => { this.setLanguage(lang); }
        })),
        { text: this.translate.instant('buttons.cancel'), role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  setLanguage(lang: string) {
    this.translate.use(lang)
  }

  // ---- Signature ------------------------------------------------------

  private initSignaturePad(canvas: HTMLCanvasElement, restore: string | null = null) {
    // The bitmap has to match the element's own size, or every stroke lands
    // offset from the pen: a canvas defaults to 300x150 whatever the CSS says.
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = canvas.offsetHeight || 150;

    this.signaturePad = new SignaturePad(canvas, {
      penColor: this.colorService.getIonTextColor()
    });

    // The size has to be passed: fromDataURL defaults to
    // `canvas.width / devicePixelRatio`, and this bitmap is in CSS pixels, so
    // on a phone it redrew every restored signature at a third of its size in
    // the top-left corner. On the add path that shrunken image is what
    // savePassengerConfirmation() then persists, once per step-back.
    const size = { width: canvas.width, height: canvas.height };
    if (this.isView && this.passengerData.signature) {
      this.signaturePad.fromDataURL(this.passengerData.signature, size);
    } else if (restore) {
      this.signaturePad.fromDataURL(restore, size);
    }
    this.cdr.detectChanges();
  }

  clearSignature() {
    this.signaturePad?.clear();
  }

  // ---- Actions --------------------------------------------------------

  savePassengerConfirmation() {
    if (!this.signaturePad || this.signaturePad.isEmpty()) {
      return;
    }
    this.passengerData.signature = this.signaturePad.toDataURL();
    this.passengerData.signatureMimeType = 'image/png';
    // The list page saves componentProps.passengerData, so hand back the model
    // rather than form.value - which no longer holds the whole record.
    this.modalController.dismiss(this.passengerData, 'save');
  }

  delete() {
    this.modalController.dismiss(this.passengerData, 'delete');
  }

  close() {
    this.modalController.dismiss();
  }

  clearSchoolButton() {
    this.passengerData.tandemSchool = null;
  }
}
