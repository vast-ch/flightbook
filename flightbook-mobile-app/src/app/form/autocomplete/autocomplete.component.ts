import { Component, OnInit, Input, Output, EventEmitter, ElementRef, OnChanges, OnDestroy } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from 'src/app/place/shared/place.store';
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
export class AutocompleteComponent implements OnInit, OnChanges, OnDestroy {
    private unsubscribe$ = new Subject<void>();
    private searchTerm$ = new Subject<string>();

    @Input()
    search: string;
    @Output()
    setInputValue = new EventEmitter<Place>();

    show: boolean;
    listElement: Place[];

    constructor(
        private placeStore: PlaceStore,
        private eRef: ElementRef
    ) {
        this.search = null;
        this.show = false;
        addIcons({ close });

        // Wired in the constructor, not ngOnInit: the first ngOnChanges runs
        // before ngOnInit, and a Subject drops anything emitted before there is
        // a subscriber.
        this.searchTerm$.pipe(
            // One lookup per settled prefix rather than one per keystroke.
            debounceTime(250),
            switchMap(term => this.placeStore.getPlacesByName(term, { limit: 4 }).pipe(
                catchError(() => of([] as Place[]))
            )),
            takeUntil(this.unsubscribe$)
        ).subscribe((res: Place[]) => {
            if (res && res.length > 0) {
                this.show = true;
                this.listElement = res;
            } else {
                this.show = false;
            }
        });
    }

    ngOnInit() { }

    onClick(event: any) {
        if (!this.eRef.nativeElement.contains(event.target)) { // or some similar check
            this.show = false;
        }
    }

    ngOnChanges() {
        if (this.search && this.search !== '') {
            // switchMap, not a bare subscribe: this runs on every keystroke, so
            // a slow answer for "Fie" could otherwise land after "Fiesch" and
            // put the wrong suggestions back on screen. takeUntil so the last
            // one in flight does not outlive the component.
            this.searchTerm$.next(this.search);
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

    ngOnDestroy() {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }
}
