import { Component, computed } from '@angular/core';
import { ModalController, IonContent, IonButton, IonModal, IonDatetime } from '@ionic/angular/standalone';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { AppointmentFilter } from '../../appointment-filter.model';
import { SchoolService } from '../../school.service';
import { State } from '../../state';
import { DatePipe } from '@angular/common';

/** '' is "any state", and leads the row the way the flight filter's "All" does. */
const STATES: string[] = ['', ...Object.values(State)];

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
     * The service's own signal. The sheet edits it as it goes and has no Cancel,
     * so there is nothing to mirror locally - and a mirror would now drift from
     * the chips the list draws off the same signal.
     */
    public filter = this.schoolService.filter;

    public isFiltered = computed(() => {
        const { from, to, state } = this.filter();
        return !!from || !!to || !!state;
    });

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
    }

    close() {
        return this.modalCtrl.dismiss();
    }

    private apply(patch: Partial<AppointmentFilter>) {
        this.schoolService.updateFilter(patch);
    }
}
