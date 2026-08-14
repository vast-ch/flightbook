import { Component, ElementRef, Input, ViewChild, computed, effect, signal } from '@angular/core';
import { HeatmapDay } from '../../shared/statistic.store';

export interface HeatmapCell {
    /** 0 = no flights, 1 = one, 2 = two or more. */
    level: 0 | 1 | 2;
    title: string;
}

/**
 * GitHub-style activity grid: seven rows (Mon..Sun), one column per week.
 *
 * Scrolls horizontally rather than shrinking the cells - a pilot flying since
 * 2013 produces ~650 columns, which would otherwise be sub-pixel wide.
 */
@Component({
    selector: 'fb-activity-heatmap',
    templateUrl: './activity-heatmap.component.html',
    styleUrls: ['./activity-heatmap.component.scss']
})
export class ActivityHeatmapComponent {

    @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

    private source = signal<HeatmapDay[]>([]);

    @Input() set days(value: HeatmapDay[]) {
        this.source.set(value ?? []);
    }

    public cells = computed<HeatmapCell[]>(() =>
        this.source().map(day => ({
            level: day.flights === 0 ? 0 : (day.flights === 1 ? 1 : 2),
            title: `${day.date.toLocaleDateString()} — ${day.flights}`
        }))
    );

    constructor() {
        // Open on the most recent weeks. Scrolled to the oldest, a long logbook
        // shows an empty grid while the actual flying sits off-screen right.
        effect(() => {
            this.cells();
            queueMicrotask(() => {
                const el = this.scroller?.nativeElement;
                if (el) {
                    el.scrollLeft = el.scrollWidth;
                }
            });
        });
    }
}
