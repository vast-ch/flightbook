import { Component, OnInit, Input, Output, EventEmitter, ElementRef, OnChanges } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from 'src/app/place/shared/place.store';
import { FlightStore } from 'src/app/flight/shared/flight.store';
import { addIcons } from "ionicons";
import { close } from "ionicons/icons";
import { IonIcon } from "@ionic/angular/standalone";
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'autocomplete',
    templateUrl: './autocomplete.component.html',
    styleUrls: ['./autocomplete.component.scss'],
    host: {
        '(document:click)': 'onClick($event)',
    },
    imports: [
        IonIcon,
        TranslateModule
    ]
})
export class AutocompleteComponent implements OnInit, OnChanges {
    @Input()
    search: string;
    @Output()
    setInputValue = new EventEmitter<Place>();

    show: boolean;
    listElement: Place[];

    /**
     * Flights-per-place, keyed by place id. Cached for the lifetime of the
     * component so retyping the same prefix doesn't refetch counts.
     */
    flightCounts: { [placeId: number]: number } = {};

    constructor(
        private placeStore: PlaceStore,
        private flightStore: FlightStore,
        private eRef: ElementRef
    ) {
        this.search = null;
        this.show = false;
        addIcons({ close });
    }

    ngOnInit() { }

    onClick(event: any) {
        if (!this.eRef.nativeElement.contains(event.target)) { // or some similar check
            this.show = false;
        }
    }

    ngOnChanges() {
        if (this.search && this.search !== '') {
            this.placeStore.getPlacesByName(this.search, { limit: 4 }).subscribe((res: Place[]) => {
                if (res && res.length > 0) {
                    this.show = true;
                    this.listElement = res;
                    // Fired after the list renders, so names appear immediately
                    // and counts fill in when they arrive.
                    this.loadFlightCounts(res);
                } else {
                    this.show = false;
                }
            });
        } else {
            this.show = false;
        }
    }

    /** Splits a place name so the matched prefix can be emphasised. */
    matchedPrefix(name: string): string {
        const len = this.search?.length ?? 0;
        return len && name.toLowerCase().startsWith(this.search.toLowerCase()) ? name.substring(0, len) : '';
    }

    matchedRest(name: string): string {
        return name.substring(this.matchedPrefix(name).length);
    }

    setValue(value: any) {
        this.show = false;
        this.setInputValue.emit(value);
    }

    closeList() {
        this.show = false;
    }

    private loadFlightCounts(places: Place[]) {
        const missing = places.filter(place => place.id != null && this.flightCounts[place.id] === undefined);
        if (missing.length === 0) {
            return;
        }

        forkJoin(
            missing.map(place =>
                this.flightStore.nbFlightsByPlaceId(place.id).pipe(
                    // The API returns nbFlights as a string.
                    map(resp => ({ id: place.id, count: Number(resp?.nbFlights ?? 0) })),
                    catchError(() => of({ id: place.id, count: 0 }))
                )
            )
        ).subscribe(results => {
            for (const result of results) {
                this.flightCounts[result.id] = result.count;
            }
        });
    }
}
