import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Point as GeoPoint, Position } from 'geojson';
import { Feature, View } from 'ol';
import Map from 'ol/Map';
import Attribution from 'ol/control/Attribution';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Icon, Style } from 'ol/style';
import { firstValueFrom } from 'rxjs';
import { Place } from 'src/app/place/shared/place.model';
import { PlaceStore } from 'src/app/place/shared/place.store';
import { ConfigurationService } from '../../services/configuration.service';

@Component({
    selector: 'fb-place-map',
    templateUrl: './place-map.component.html',
    styleUrls: ['./place-map.component.scss'],
    standalone: true,
})
export class PlaceMapComponent implements AfterViewInit, OnChanges, OnDestroy {

    @ViewChild('mapContainer', { static: true }) private mapContainer: ElementRef<HTMLDivElement>;

    private map: Map;
    private vectorSource = new VectorSource();
    private vectorLayer: VectorLayer<any>;

    private marker = new Feature();

    private timerId: NodeJS.Timeout;

    /** True while the pin is the name lookup's guess rather than a real choice. */
    private coordinatesFromSearch = false;
    /**
     * What this component last wrote into altitude and country. Compared against
     * the field rather than tracked as a "we filled this once" flag: that flag
     * never went back to false, so once the pilot corrected an auto-filled
     * altitude the next rename claimed the corrected value as ours and
     * overwrote it. A value still equal to the guess is ours to refine; the
     * moment it differs, it is the pilot's to keep.
     */
    private guessedAltitude?: number;
    private guessedCountry?: string;

    @Input()
    placeName: String;

    @Input()
    place: Place;

    constructor(
        private placeStore: PlaceStore,
        private alertController: AlertController,
        private translate: TranslateService,
        private configurationService: ConfigurationService,
        private zone: NgZone
    ) {
        const style = new Style({
            image: new Icon({
                anchor: [0.5, 1],
                crossOrigin: 'anonymous',
                src: 'assets/icon/marker.png',
            })
        });

        this.vectorSource.addFeature(this.marker);

        this.vectorLayer = new VectorLayer({
            source: this.vectorSource,
            style: style
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Only placeName drives the lookup; a `place`-only change used to throw
        // here because changes.placeName was dereferenced unconditionally.
        const placeName = changes.placeName;
        if (!placeName) {
            return;
        }

        // Never on the first change: that one is the place arriving from the
        // store, and re-geocoding a place the pilot already saved replaced
        // their surveyed altitude and country with an OSM guess a second after
        // the form opened - silently, and then on Save. `new Place()` has no
        // name, so the add form loses nothing.
        if (placeName.firstChange) {
            return;
        }

        // A pin the lookup placed may follow further typing; one the pilot placed,
        // or one loaded with an existing place, must not be moved by a rename.
        const ownsPin = !this.place?.coordinates || this.coordinatesFromSearch;
        if (ownsPin && placeName.currentValue && placeName.currentValue != "") {
            clearTimeout(this.timerId);
            this.timerId = setTimeout(() => this.searchPlace(placeName.currentValue), 1000);
        }
    }

    private destroyed = false;

    ngAfterViewInit() {
        this.initMap(this.place.coordinates);
    }

    /**
     * Same teardown the IGC map got: an OpenLayers Map holds its target and its
     * tile sources until disposed, and the debounced lookup can still fire a
     * second after the form closed.
     */
    ngOnDestroy() {
        this.destroyed = true;
        clearTimeout(this.timerId);
        this.map?.setTarget(undefined);
        this.map?.dispose();
    }

    private async searchPlace(name: string) {
        const res = await firstValueFrom(this.placeStore.searchOpenstreetmapPlace(name));
        if (this.destroyed || !this.map || !res.features || res.features.length === 0) {
            return;
        }
        const geometry = res.features[0]?.geometry as GeoPoint
        const position = fromLonLat(geometry.coordinates);

        // Centring alone left the map looking unset: mark the hit, and keep it
        // as the place's position so saving stores what is on screen.
        this.marker.setGeometry(new Point(position));
        this.place.coordinates = position;
        this.coordinatesFromSearch = true;

        this.map.getView().setCenter(position);
        this.map.getView().setZoom(14);

        await this.applySearchMetadata(geometry.coordinates);
    }

    /**
     * Altitude and country for a pin the lookup placed, so a place created by
     * name alone saves with the same fields a double-tapped one does.
     *
     * Silent, unlike the double-tap path: this runs off the debounced rename,
     * and the only values it can overwrite are an earlier guess of its own -
     * ngOnChanges will not call us once the pilot has placed the pin themselves.
     * The metadata lookup is best-effort; losing it must not undo the position.
     */
    private async applySearchMetadata(lonLat: Position) {
        try {
            const metadata = await firstValueFrom(this.placeStore.getPlaceMetadata(lonLat));
            if (this.destroyed || !this.coordinatesFromSearch) {
                return;
            }
            this.zone.run(() => {
                // Fill an empty field, or refine an earlier guess of our own -
                // but never replace a value the pilot entered. An existing
                // place reaches here by being renamed, and its altitude may
                // have been surveyed rather than looked up.
                if (this.ownsAltitude()) {
                    this.place.altitude = metadata.altitude;
                    this.guessedAltitude = metadata.altitude;
                }
                if (this.ownsCountry()) {
                    this.place.country = metadata.country;
                    this.guessedCountry = metadata.country;
                }
            });
        } catch {
            // Keep the coordinates; the pilot can still fill these in by hand.
        }
    }

    /**
     * Empty counts as ours - there is nothing to lose by filling it. An
     * ion-input can hand the value back as a string, which fails the identity
     * check and so errs towards leaving it alone: the safe direction.
     */
    private ownsAltitude(): boolean {
        return this.place.altitude == null || this.place.altitude === this.guessedAltitude;
    }

    private ownsCountry(): boolean {
        return !this.place.country || this.place.country === this.guessedCountry;
    }

    /**
     * The deliberate double-tap path, which replaces both fields together.
     * Recording what it wrote is what lets a second double-tap tell its own
     * guess from a surveyed value and skip the confirm only for the former.
     */
    private writeMetadata(metadata: Place) {
        this.place.altitude = metadata.altitude;
        this.guessedAltitude = metadata.altitude;
        this.place.country = metadata.country;
        this.guessedCountry = metadata.country;
    }

    private async initMap(position?: Position) {
        const config = await firstValueFrom(this.configurationService.getMapConfiguration());
        // The configuration is an HTTP call: leaving the form before it returns
        // would otherwise build a Map against a detached element that
        // ngOnDestroy has already run past, so nothing ever disposes it.
        if (this.destroyed) {
            return;
        }
        const attributionControl = new Attribution({
            collapsible: true,
            collapsed: true
        })

        let zoom = 1;
        let mapPoition = [0, 0];

        if (position && position != null) {
            this.marker.setGeometry(new Point(position));
            zoom = 15;
            mapPoition = position;
        }

        this.map = new Map({
            layers: [
                new TileLayer({
                    source: new OSM({
                        url: config.url,
                        attributions: config.attributions,
                        crossOrigin: config.crossOrigin
                    })
                }),
                this.vectorLayer
            ],
            controls: [attributionControl],
            target: this.mapContainer.nativeElement,
            view: new View({
                center: mapPoition,
                zoom: zoom,
            }),
        });

        this.map.on('dblclick', this.onDblclick)
    }

    onDblclick = (async (evt: any) => {
        this.place.coordinates = evt.coordinate;
        // Only skip the confirm when the altitude on the place really is our
        // own guess. coordinatesFromSearch was too loose: the pin can come from
        // the name lookup while the metadata request that follows it failed,
        // leaving a typed altitude that would then be replaced unannounced.
        const autoFilled = this.ownsAltitude();
        // Placed deliberately, so the name lookup stops moving it.
        this.coordinatesFromSearch = false;
        this.marker.setGeometry(new Point(evt.coordinate));
        const epsgGeometry: any = this.marker.getGeometry().clone().transform(this.map.getView().getProjection(), 'EPSG:4326')
        const res = await firstValueFrom(this.placeStore.getPlaceMetadata(epsgGeometry.flatCoordinates));

        if (this.place.altitude && !autoFilled) {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('place.override'),
                buttons: [
                    {
                        text: this.translate.instant('buttons.yes'),
                        handler: () => {
                            this.writeMetadata(res);
                        }
                    },
                    this.translate.instant('buttons.no')
                ]
            });

            await alert.present();
            await alert.onDidDismiss();
            await alert.dismiss();
        } else {
            this.zone.run(() => this.writeMetadata(res));
        }
    });
}
