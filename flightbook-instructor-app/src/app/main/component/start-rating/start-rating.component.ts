import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-start-rating',
    templateUrl: './start-rating.component.html',
    styleUrls: ['./start-rating.component.scss'],
    standalone: false
})
export class StartRatingComponent implements OnInit, OnChanges {

  @Input()
  selectedRating: number | undefined;

  /** Optional row context (e.g. "Start", "Théorie") interpolated into each star's
   *  accessible name, so screen readers don't announce three identical "Rating N of 3"
   *  labels when several rating rows sit next to each other (e.g. the Level card). */
  @Input()
  label: string | undefined;

  /** Size modifier: the Level card uses 26px star glyphs, the Kontrollblatt items use the
   *  default 16px (see CONTRACT.md / students-screen.html:186 vs :221 - `bigStyle` vs `style`). */
  @Input()
  big = false;

  @Output() clickRating = new EventEmitter<number>();

  stars = [
    { id: 1, filled: false },
    { id: 2, filled: false },
    { id: 3, filled: false }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedRating']) {
      this.displayStars(this.selectedRating || 0);
    }
  }

  displayStars(value: number): void {
    this.stars.forEach((star) => {
      star.filled = star.id <= value;
    });
  }

  selectStar(value: number): void {
    if (this.selectedRating === value) {
      value = value - 1;
    }
    this.displayStars(value);

    this.selectedRating = value;
    this.clickRating.emit(this.selectedRating);
  }
}
