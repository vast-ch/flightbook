import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ControlSheet } from 'src/app/shared/domain/control-sheet';
import { SchoolService } from '../shared/school.service';
import { Subject, takeUntil } from 'rxjs';
import { AlertController, LoadingController, ModalController, NavController, IonContent, IonIcon, IonModal, IonDatetime } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ControlSheetDetailsComponent } from '../shared/components/control-sheet-details/control-sheet-details.component';
import { NxgTransalteSortPipe } from 'src/app/shared/pipes/nxg-transalte-sort.pipe';
import { DatePipe } from '@angular/common';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { AvatarButtonComponent } from 'src/app/shared/components/avatar-button/avatar-button.component';
import { HomeStore } from 'src/app/home/shared/home.store';
import { addIcons } from 'ionicons';
import { chevronBack, chevronDown, chevronForward, chevronUp, checkmark } from 'ionicons/icons';

/** The three rated groups, in the order the design lists them. */
type SkillGroup = 'theory' | 'trainingHill' | 'altitudeFlight';

type SkillRow = { key: string, value: number };

@Component({
    selector: 'app-control-sheet',
    templateUrl: './control-sheet.page.html',
    styleUrls: ['./control-sheet.page.scss'],
    imports: [
        AvatarButtonComponent,
        DatePipe,
        IonDatetime,
        StarRatingComponent,
        TranslateModule,
        IonContent,
        IonIcon,
        IonModal
    ]
})
export class ControlSheetPage implements OnInit, OnDestroy {
    unsubscribe$ = new Subject<void>();
    controlSheet: ControlSheet | undefined;

    orderedAltitudeFlight: SkillRow[] = [];
    orderedTheory: SkillRow[] = [];
    orderedTrainingHill: SkillRow[] = [];

    language: string;
    theoryExamDate: string;
    practiceExamDate: string;

    /**
     * Only one group is open at a time. Collapsed groups show a progress bar
     * instead of their rows - with 30 altitude skills, four always-open
     * accordions were what made this screen unreadable.
     */
    public expandedGroup = signal<SkillGroup | null>('theory');

    /** Rendered in this order; declared here so the template stays typed. */
    public readonly groups: SkillGroup[] = ['theory', 'trainingHill', 'altitudeFlight'];

    /** Home already derives the licence summary; no need to recompute it here. */
    public licenceProgress = this.homeStore.licenceProgress;
    public soloFlightDone = this.homeStore.soloFlightDone;
    public trainingProgress = this.homeStore.trainingProgress;

    public schoolName = computed(() => this.trainingProgress()?.schoolName ?? null);

    constructor(
        private schoolService: SchoolService,
        private loadingCtrl: LoadingController,
        private modalCtrl: ModalController,
        private alertController: AlertController,
        private translate: TranslateService,
        private navCtrl: NavController,
        private homeStore: HomeStore,
        private nxgTransalteSortPipe: NxgTransalteSortPipe
    ) {
        this.language = this.translate.currentLang;
        addIcons({
            'chevron-back': chevronBack,
            'chevron-down': chevronDown,
            'chevron-forward': chevronForward,
            'chevron-up': chevronUp,
            checkmark
        });
    }

    ngOnInit() {
        this.initialDataLoad();

        // The summary card reads HomeStore, which is only populated if Home has
        // been visited - this page is also reachable directly.
        if (!this.homeStore.loaded()) {
            this.homeStore.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
        }
    }

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    // ---- View state -----------------------------------------------------

    close() {
        this.navCtrl.navigateBack('more');
    }

    isExpanded(group: SkillGroup): boolean {
        return this.expandedGroup() === group;
    }

    toggleGroup(group: SkillGroup) {
        this.expandedGroup.update(current => (current === group ? null : group));
    }

    rows(group: SkillGroup): SkillRow[] {
        switch (group) {
            case 'theory': return this.orderedTheory;
            case 'trainingHill': return this.orderedTrainingHill;
            case 'altitudeFlight': return this.orderedAltitudeFlight;
        }
    }

    /** Rated (>= 1 star) out of total, matching how Home counts progress. */
    ratedCount(group: SkillGroup): number {
        return this.rows(group).filter(row => (row.value ?? 0) > 0).length;
    }

    totalCount(group: SkillGroup): number {
        return this.rows(group).length;
    }

    groupPercent(group: SkillGroup): number {
        const total = this.totalCount(group);
        if (total === 0) {
            return 0;
        }
        return Math.min(100, Math.round((this.ratedCount(group) / total) * 100));
    }

    /** Theory skills are plain names in i18n; the other two carry `.title`. */
    labelKey(group: SkillGroup, key: string): string {
        return group === 'theory'
            ? `controlSheet.theory.${key}`
            : `controlSheet.${group}.${key}.title`;
    }

    /** Only trainingHill and altitudeFlight have coaching content to open. */
    hasDetail(group: SkillGroup): boolean {
        return group !== 'theory';
    }

    get canEdit(): boolean {
        return !!this.controlSheet?.userCanEdit;
    }

    // ---- Data -----------------------------------------------------------

    private async initialDataLoad() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.schoolService.getControlSheet().pipe(takeUntil(this.unsubscribe$)).subscribe({
            next: async (controlSheet: ControlSheet) => {
                this.controlSheet = controlSheet;
                this.theoryExamDate = this.controlSheet?.passTheoryExam
                    ? new Date(this.controlSheet.passTheoryExam).toISOString()
                    : new Date().toISOString();
                this.practiceExamDate = this.controlSheet?.passPracticeExam
                    ? new Date(this.controlSheet.passPracticeExam).toISOString()
                    : new Date().toISOString();
                this.orderControlSheet(controlSheet);
                await loading.dismiss();
            },
            error: async () => {
                await loading.dismiss();
                // Previously this left a blank screen with no explanation.
                await this.alert(this.translate.instant('message.infotitle'), this.translate.instant('message.error'));
            }
        });
    }

    private orderControlSheet(controlSheet: ControlSheet) {
        this.orderedAltitudeFlight = this.toRows(controlSheet.altitudeFlight);
        this.nxgTransalteSortPipe.transform(this.orderedAltitudeFlight, 'altitudeFlight');

        // Theory has no `order` key in i18n, so it keeps its natural order.
        this.orderedTheory = this.toRows(controlSheet.theory);

        this.orderedTrainingHill = this.toRows(controlSheet.trainingHill);
        this.nxgTransalteSortPipe.transform(this.orderedTrainingHill, 'trainingHill');
    }

    /** `id` is a database key, not a skill - filtered here rather than in the template. */
    private toRows(group: any): SkillRow[] {
        if (!group) {
            return [];
        }
        return Object.keys(group)
            .filter(key => key !== 'id')
            .map(key => ({ key, value: group[key] }));
    }

    /**
     * One sheet per skill, as the design has it: the rating and the coaching
     * text share it, so a student rates what they are reading about. Theory
     * skills have no coaching text, so their sheet opens shallower.
     */
    async openSkill(group: SkillGroup, row: SkillRow) {
        /*
         * A fixed height rather than sheet breakpoints. A breakpoint sheet is
         * full-height and translated down, so everything below the breakpoint
         * sits off-screen - and with 0.82 as the largest one, the last fifth of
         * the coaching text could never be scrolled to.
         */
        const modal = await this.modalCtrl.create({
            component: ControlSheetDetailsComponent,
            cssClass: this.hasDetail(group) ? 'skill-sheet-modal' : 'skill-sheet-modal skill-sheet-modal--short',
            componentProps: {
                type: group,
                key: row.key,
                titleKey: this.labelKey(group, row.key),
                rating: row.value ?? 0,
                canEdit: this.canEdit,
                persist: (value: number) => this.saveRating(group, row.key, value)
            }
        });

        return await modal.present();
    }

    async saveRating(group: SkillGroup, key: string, value: number) {
        this.controlSheet[group][key] = value;

        const rows = this.rows(group);
        const index = rows.findIndex(row => row.key === key);
        if (index > -1) {
            rows[index] = { key, value };
        }

        await this.postControlSheet();
    }

    /**
     * With showDefaultButtons the wheel only stages its value internally -
     * ion-datetime emits ionChange once, when Done is pressed - so posting
     * straight from here is a single save, not one per scroll tick.
     */
    async onTheoryDateChange(event: any) {
        this.theoryExamDate = event.detail.value;
        this.controlSheet.passTheoryExam = new Date(event.detail.value);
        await this.postControlSheet();
    }

    async onPracticeDateChange(event: any) {
        this.practiceExamDate = event.detail.value;
        this.controlSheet.passPracticeExam = new Date(event.detail.value);
        await this.postControlSheet();
    }

    async clearDate(type: 'theoryExam' | 'practiceExam') {
        if (type === 'theoryExam') {
            this.controlSheet.passTheoryExam = undefined;
            this.theoryExamDate = new Date().toISOString();
        } else {
            this.controlSheet.passPracticeExam = undefined;
            this.practiceExamDate = new Date().toISOString();
        }
        await this.postControlSheet();
    }

    private async postControlSheet() {
        const loading = await this.loadingCtrl.create({
            message: this.translate.instant('loading.loading')
        });
        await loading.present();
        this.schoolService.postControlSheet(this.controlSheet).pipe(takeUntil(this.unsubscribe$))
            .subscribe({
                next: async () => {
                    await loading.dismiss();
                    // Home shows the same counts; keep them in step.
                    this.homeStore.load().pipe(takeUntil(this.unsubscribe$)).subscribe();
                },
                error: async () => {
                    await loading.dismiss();
                    // Roll the optimistic mutation back from the server.
                    this.initialDataLoad();
                    await this.alert(this.translate.instant('message.infotitle'), this.translate.instant('message.error'));
                }
            });
    }

    private async alert(header: string, message: string) {
        const alert = await this.alertController.create({
            header,
            message,
            buttons: [this.translate.instant('buttons.done')]
        });
        await alert.present();
    }
}
