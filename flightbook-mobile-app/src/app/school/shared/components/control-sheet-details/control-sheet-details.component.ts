import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalController, IonContent, IonButton } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { StarRatingComponent } from 'src/app/shared/components/star-rating/star-rating.component';

/**
 * Headings that introduce the "what goes wrong" section. The coaching copy is a
 * single HTML blob per skill, so matching the heading text is the only signal we
 * have for which section to tint - and the SHV copy is German in every locale.
 */
const CAUTION_HEADING = /^(fehler|gefahr|mistake|erreur|risque|danger|errori|pericol)/i;

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
export class ControlSheetDetailsComponent implements OnInit {

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
