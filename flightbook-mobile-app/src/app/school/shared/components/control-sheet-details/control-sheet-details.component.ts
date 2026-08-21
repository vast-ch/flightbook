import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController, IonContent, IonButton, createGesture, Gesture, GestureDetail } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { StarRatingComponent } from 'src/app/shared/components/star-rating/star-rating.component';

/**
 * Headings that introduce the "what goes wrong" section. The coaching copy is a
 * single HTML blob per skill, so matching the heading text is the only signal we
 * have for which section to tint - and the SHV copy is German in every locale.
 */
const CAUTION_HEADING = /^(fehler|gefahr|mistake|erreur|risque|danger|errori|pericol)/i;

/** How far the sheet must be pulled down to close on release, in pixels. */
const DISMISS_DISTANCE = 90;
/** Or how fast, so a short flick closes it too. */
const DISMISS_VELOCITY = 0.4;

@Component({
    selector: 'app-control-sheet-details',
    templateUrl: './control-sheet-details.component.html',
    styleUrls: ['./control-sheet-details.component.scss'],
    // Required: the coaching text arrives via [innerHTML], which emulated
    // encapsulation cannot reach. Keep every selector here class-scoped, and
    // avoid :host - it does not apply once encapsulation is off.
    encapsulation: ViewEncapsulation.None,
    imports: [
        TranslateModule,
        StarRatingComponent,
        IonContent,
        IonButton
    ]
})
export class ControlSheetDetailsComponent implements OnInit, AfterViewInit, OnDestroy {

    private host = inject(ElementRef<HTMLElement>);

    @Input() type: string;
    @Input() key: string;

    /** Resolved by the page, which already knows how each group names its keys. */
    @Input() titleKey: string;

    @Input() rating = 0;
    @Input() canEdit = false;

    /**
     * Saves a new rating. A sheet modal can be dragged shut as well as
     * dismissed, so persisting per tap is what keeps a rating from being lost
     * on the way out.
     */
    @Input() persist?: (value: number) => void;

    /** Null for theory, whose skills are names without coaching content. */
    content: string | null = null;

    /**
     * Resolved once, not from the template. bypassSecurityTrustResourceUrl
     * returns a fresh object every call, so binding it into [src] made the
     * binding dirty on every change-detection pass and the iframe re-navigated
     * - which, inside a scrolling Ionic modal, meant the player restarted
     * dozens of times a second and never finished loading.
     */
    safeVideoUrl: SafeResourceUrl | null = null;

    constructor(
        private modalCtrl: ModalController,
        private sanitizer: DomSanitizer,
        private translate: TranslateService
    ) { }

    ngOnInit(): void {
        this.content = this.buildContent();
        const video = this.videoUrl();
        this.safeVideoUrl = video ? this.sanitizer.bypassSecurityTrustResourceUrl(video) : null;
    }

    get levelKey(): string {
        return `controlSheet.level.${this.rating || 0}`;
    }

    onRate(value: number) {
        this.rating = value;
        this.persist?.(value);
    }

    /**
     * null for 42 of the 48 skills, so the template must check the value - and
     * theory skills have no `video` key at all, which resolves to the key
     * itself. Without that check the iframe would load "controlSheet.theory.x
     * .video" as a relative URL, which the SPA fallback answers with index.html:
     * the whole app, booted again inside the sheet.
     */
    private videoUrl(): string | null {
        const url = this.translate.instant(`controlSheet.${this.type}.${this.key}.video`);
        if (!url || typeof url !== 'string' || url.startsWith('controlSheet.')) {
            return null;
        }
        return url;
    }

    close() {
        return this.modalCtrl.dismiss();
    }

    /**
     * Swipe the head down to close, besides the Done button.
     *
     * Hand-rolled rather than Ionic's sheet gesture, which comes with
     * `breakpoints` - and a breakpoint sheet is full height and translated down,
     * so the bottom of the coaching text could never be scrolled to. This drives
     * --fb-sheet-drag on the modal host instead, which tokens.scss applies to
     * ::part(content): the sheet follows the finger while the backdrop stays put.
     */
    ngAfterViewInit(): void {
        const modal = this.host.nativeElement.closest('ion-modal') as HTMLElement | null;
        const head = this.host.nativeElement.querySelector('.skill-sheet__head') as HTMLElement | null;
        if (!modal || !head) {
            return;
        }
        this.modal = modal;

        this.gesture = createGesture({
            el: head,
            gestureName: 'skill-sheet-drag',
            direction: 'y',
            threshold: 6,
            // Not from the stars: dragging across them is how a rating is given.
            canStart: (detail: GestureDetail) =>
                !(detail.event.target as HTMLElement)?.closest('fb-star-rating'),
            onStart: () => modal.classList.remove('is-snapping'),
            // Downwards only. Pulling up on a sheet already at its full height
            // would just detach it from the bottom edge.
            onMove: (detail: GestureDetail) =>
                this.setDrag(Math.max(0, detail.deltaY)),
            onEnd: (detail: GestureDetail) => {
                if (detail.deltaY > DISMISS_DISTANCE || detail.velocityY > DISMISS_VELOCITY) {
                    // Reset first: Ionic's leave animation drives the same
                    // element, and it should start from where the sheet sits.
                    this.setDrag(0);
                    this.close();
                    return;
                }
                modal.classList.add('is-snapping');
                this.setDrag(0);
            }
        });
        this.gesture.enable(true);
    }

    ngOnDestroy(): void {
        this.gesture?.destroy();
    }

    private gesture?: Gesture;
    private modal?: HTMLElement;

    private setDrag(px: number): void {
        this.modal?.style.setProperty('--fb-sheet-drag', `${px}px`);
    }

    private buildContent(): string | null {
        const raw = this.translate.instant(`controlSheet.${this.type}.${this.key}.content`);
        // A missing key resolves to the key itself - that is theory's case.
        if (!raw || typeof raw !== 'string' || raw.startsWith('controlSheet.')) {
            return null;
        }
        return raw.replace(/<h2>([\s\S]*?)<\/h2>/g, (match: string, heading: string) =>
            CAUTION_HEADING.test(this.plainText(heading))
                ? `<h2 class="is-caution">${heading}</h2>`
                : match);
    }

    private plainText(value: string): string {
        return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
    }
}
