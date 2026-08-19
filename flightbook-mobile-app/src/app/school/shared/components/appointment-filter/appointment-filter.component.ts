import { Component, computed, signal } from '@angular/core';
import { ModalController, IonContent, IonButton, IonModal, IonDatetime } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AppointmentFilter } from '../../appointment-filter.model';
import { SchoolService } from '../../school.service';
import { DatePipe } from '@angular/common';

/** '' is "any state", and leads the row the way the flight filter's "All" does. */
const STATES = ['', 'ANNOUNCED', 'CONFIRMED', 'CANCELED'];

@Component({
    selector: 'fb-appointment-filter',
    templateUrl: './appointment-filter.component.html',
    styleUrls: ['./appointment-filter.component.scss'],
    imports: [
        DatePipe,
        TranslateModule,
        IonContent,
        IonButton,
        IonModal,
        IonDatetime
    ]
})
export class AppointmentFilterComponent {
    public readonly states = STATES;
    public language: string;

    /**
     * The sheet edits the service's filter as it goes and has no Cancel, so the
     * signal is only what the template renders from - SchoolService.filter is a
     * plain object, and mutating it would not repaint anything.
     */
    public filter = signal<AppointmentFilter>(this.schoolService.filter);

    public isFiltered = computed(() => {
        const { from, to, state } = this.filter();
        return !!from || !!to || !!state;
    });

    /** Closing an untouched sheet must not cost the host a reload. */
    private touched = false;

    constructor(
        private schoolService: SchoolService,
        private translate: TranslateService,
        private modalCtrl: ModalController
    ) {
        this.language = translate.currentLang;
    }

    changeDate(type: 'from' | 'to', event: CustomEvent) {
        const value = event.detail.value ? new Date(event.detail.value) : new Date();
        this.apply(type === 'from' ? { from: value } : { to: value });
    }

    clearDateButton(type: 'from' | 'to') {
        this.apply(type === 'from' ? { from: null } : { to: null });
    }

    setState(state: string) {
        this.apply({ state });
    }

    clearFilter() {
        // The service's own reset, so the filtered flag it keeps for the list's
        // header chip is cleared with it.
        this.schoolService.resetFilter();
        this.filter.set(this.schoolService.filter);
        this.touched = true;
    }

    close() {
        return this.modalCtrl.dismiss(null, this.touched ? 'filter' : undefined);
    }

    private apply(patch: Partial<AppointmentFilter>) {
        const next = Object.assign(new AppointmentFilter(), this.filter(), patch);
        this.schoolService.filter = next;
        this.filter.set(next);
        this.touched = true;
    }
}
