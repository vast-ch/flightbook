import { Component, ElementRef, Injector, Input, ViewChild, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { LanguageService } from 'src/app/shared/services/language.service';
import { HeatmapDay } from '../../shared/statistic.store';

export interface HeatmapCell {
    /** Four levels, matching the design's legend: none, one, two, three or more. */
    level: 0 | 1 | 2 | 3;
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

    private languageService = inject(LanguageService);

    private source = signal<HeatmapDay[]>([]);

    @Input() set days(value: HeatmapDay[]) {
        this.source.set(value ?? []);
    }

    public cells = computed<HeatmapCell[]>(() => {
        // Read as a signal so the tooltips re-render on a language switch.
        const lang = this.languageService.lang();
        return this.source().map(day => ({
            level: day.flights === 0 ? 0 : (day.flights === 1 ? 1 : (day.flights === 2 ? 2 : 3)),
            title: `${day.date.toLocaleDateString(lang)} — ${day.flights}`
        } as HeatmapCell));
    });

    private injector = inject(Injector);

    constructor() {
        // Open on the most recent weeks. Scrolled to the oldest, a long logbook
        // shows an empty grid while the actual flying sits off-screen right.
        //
        // afterNextRender, not queueMicrotask: a microtask runs before the
        // browser has laid the new cells out, so scrollWidth could still be the
        // previous grid's - which read as "works in dev, short on a cold load".
        effect(() => {
            this.cells();
            afterNextRender(() => {
                const el = this.scroller?.nativeElement;
                if (el) {
                    el.scrollLeft = el.scrollWidth;
                }
            }, { injector: this.injector });
        });
    }
}
