import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { ControlSheet } from 'src/app/shared/domain/control-sheet';
import moment from 'moment';

type RatingSection = { [key: string]: number | undefined };

@Component({
    selector: 'fb-control-sheet',
    templateUrl: './control-sheet.component.html',
    styleUrls: ['./control-sheet.component.scss'],
    standalone: false
})
export class ControlSheetComponent implements OnInit {
  @Input()
  controlSheet: ControlSheet | undefined;

  /** `ratings` renders the Kontrollblatt accordion (Übungshang/Theorie/Höhenflüge).
   *  `exams` renders the Prüfungen date fields. Lets student-detail show them as two
   *  separate cards without duplicating the save handlers. */
  @Input()
  section: 'ratings' | 'exams' = 'ratings';

  @Output() saveControlSheetEvent = new EventEmitter<ControlSheet>();

  constructor() { }

  ngOnInit(): void {
  }

  saveTrainingHill(value: number, key: any) {
    if (this.controlSheet && this.controlSheet?.trainingHill) {
      this.controlSheet.trainingHill[key] = value;
      this.saveControlSheetEvent.emit(this.controlSheet);
    }
  }

  saveTheory(value: number, key: any) {
    if (this.controlSheet && this.controlSheet?.theory) {
      this.controlSheet.theory[key] = value;
      this.saveControlSheetEvent.emit(this.controlSheet);
    }
  }

  saveAltitudeFlight(value: number, key: any) {
    if (this.controlSheet && this.controlSheet?.altitudeFlight) {
      this.controlSheet.altitudeFlight[key] = value;
      this.saveControlSheetEvent.emit(this.controlSheet);
    }
  }

  saveExamTheory(value: Date) {
    if (this.controlSheet) {
      // Convert local date to UTC date (preserving the date components)
      const localDate = moment(value);
      const utcDate = moment.utc({
        year: localDate.year(),
        month: localDate.month(),
        date: localDate.date()
      });
      this.controlSheet.passTheoryExam = utcDate.toDate();
      this.saveControlSheetEvent.emit(this.controlSheet);
    }
  }

  saveExamPractice(value: Date) {
    if (this.controlSheet) {
      // Convert local date to UTC date (preserving the date components)
      const localDate = moment(value);
      const utcDate = moment.utc({
        year: localDate.year(),
        month: localDate.month(),
        date: localDate.date()
      });
      this.controlSheet.passPracticeExam = utcDate.toDate();
      this.saveControlSheetEvent.emit(this.controlSheet);
    }
  }

  addControlSheet() {
    this.controlSheet = new ControlSheet();
    this.saveControlSheetEvent.emit(this.controlSheet);
  }

  canEditChange(event: MatSlideToggleChange) {
    this.controlSheet!.userCanEdit = event.checked;
    this.saveControlSheetEvent.emit(this.controlSheet);
  }

  /** Number of rated (> 0) items in a Kontrollblatt section, excluding the `id` field. */
  countRated(section: RatingSection | undefined): number {
    if (!section) {
      return 0;
    }
    return Object.keys(section).filter((key) => key !== 'id' && (section[key] || 0) > 0).length;
  }

  /** Total number of ratable items in a Kontrollblatt section, excluding the `id` field. */
  countTotal(section: RatingSection | undefined): number {
    if (!section) {
      return 0;
    }
    return Object.keys(section).filter((key) => key !== 'id').length;
  }

  ratioPercent(section: RatingSection | undefined): number {
    const total = this.countTotal(section);
    return total === 0 ? 0 : Math.round((this.countRated(section) / total) * 100);
  }
}
