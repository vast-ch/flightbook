import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { star } from "ionicons/icons";

@Component({
    selector: 'fb-star-rating',
    templateUrl: './star-rating.component.html',
    styleUrls: ['./star-rating.component.scss'],
    imports: [NgClass, IonIcon]
})
export class StarRatingComponent implements OnInit, OnChanges {
    @Input()
    selectedRating: number | undefined;

    @Input()
    edit: boolean = true;

    @Output() selectEvent = new EventEmitter<number>();

    stars: any[];

    constructor() {
        addIcons({ star });
     }

    ngOnInit(): void {
        this.stars = [1, 2, 3].map(id => ({ id, icon: 'star', class: '' }));
        this.displayStars(this.selectedRating || 0);
    }

    /**
     * ngOnInit alone left the stars stale whenever the parent pushed a new
     * rating into an already-created component - which is exactly what happens
     * when a control-sheet row is re-rated.
     */
    ngOnChanges(changes: SimpleChanges): void {
        if ((changes['selectedRating'] || changes['edit']) && this.stars) {
            this.displayStars(this.selectedRating || 0);
        }
    }

    /**
     * Rebuilds the class of every star. `star-hover` is part of it, not set
     * once in ngOnInit: this method overwrote the class on that very first
     * call, so the hover preview the stylesheet describes was never in the DOM.
     */
    displayStars(value: number): void {
        const hover = this.edit ? ' star-hover' : '';
        for (const star of this.stars) {
            star.class = `${star.id <= value ? 'star-gold' : 'star-gray'} star${hover}`;
        }
    }


    selectStar(value: any): void {
        if (!this.edit) {
            return;
        }

        if (this.selectedRating === value) {
            value = value - 1;
        }
        this.displayStars(value);

        this.selectedRating = value;
        this.selectEvent.emit(this.selectedRating);
    }

}
