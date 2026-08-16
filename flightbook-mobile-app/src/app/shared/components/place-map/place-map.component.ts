import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
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
export class PlaceMapComponent implements AfterViewInit, OnChanges {

    @ViewChild('mapContainer', { static: true }) private mapContainer: ElementRef<HTMLDivElement>;

    private map: Map;
    private vectorSource = new VectorSource();
    private vectorLayer: VectorLayer<any>;

    private marker = new Feature();

    private timerId: NodeJS.Timeout;

    /** True while the pin is the name lookup's guess rather than a real choice. */
    private coordinatesFromSearch = false;

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

        if (placeName.firstChange && this.place?.coordinates) {
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

    ngAfterViewInit() {
        this.initMap(this.place.coordinates);
    }

    private async searchPlace(name: string) {
        const res = await firstValueFrom(this.placeStore.searchOpenstreetmapPlace(name));
        if (!res.features || res.features.length === 0) {
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
    }

    private async initMap(position?: Position) {
        const config = await firstValueFrom(this.configurationService.getMapConfiguration());
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
        // Placed deliberately, so the name lookup stops moving it.
        this.coordinatesFromSearch = false;
        this.marker.setGeometry(new Point(evt.coordinate));
        const epsgGeometry: any = this.marker.getGeometry().clone().transform(this.map.getView().getProjection(), 'EPSG:4326')
        const res = await firstValueFrom(this.placeStore.getPlaceMetadata(epsgGeometry.flatCoordinates));

        if (this.place.altitude) {
            const alert = await this.alertController.create({
                header: this.translate.instant('message.infotitle'),
                message: this.translate.instant('place.override'),
                buttons: [
                    {
                        text: this.translate.instant('buttons.yes'),
                        handler: () => {
                            this.place.altitude = res.altitude;
                            this.place.country = res.country;
                        }
                    },
                    this.translate.instant('buttons.no')
                ]
            });

            await alert.present();
            await alert.onDidDismiss();
            await alert.dismiss();
        } else {
            this.zone.run(() => {
                this.place.altitude = res.altitude;
                this.place.country = res.country;
            });
        }
    });
}
