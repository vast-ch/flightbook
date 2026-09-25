import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from '@angular/core';
import Feature from 'ol/Feature';
import IGC from 'ol/format/IGC';
import Map from 'ol/Map';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import View from 'ol/View';
import Attribution from 'ol/control/Attribution';
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style';
import { LineString, Point } from 'ol/geom';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import IGCParser from 'igc-parser';
import { ConfigurationService } from '../../services/configuration.service';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { IonRange, IonButton, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { play, pause } from 'ionicons/icons';
import { VARIO_STEPS, varioGradientCss, varioStepColor, varioStepIndex } from './vario-ramp';
import { themeColor, withAlpha } from '../../util/theme-color';

/** Whole track replays in this many ms, regardless of flight length. */
const REPLAY_DURATION_MS = 30000;

/**
 * Half-width, in fixes, of the moving average applied to raw vario. Wider than
 * the five colours it used to feed: at 24 ramp steps the colour changes every
 * 0.4 m/s, so raw noise would break a steady thermal into a stack of runs.
 */
const VARIO_SMOOTHING = 3;

/** How often the slider/readout bindings are refreshed during replay. */
const BINDING_SYNC_MS = 100;

/** Mid-ramp, for a track with no usable vario. */
const NEUTRAL_STEP = Math.floor(VARIO_STEPS / 2);

/*
 * Where the track begins and ends. Map colours rather than theme tokens, like
 * the vario ramp: the theme's success and danger are text greens and reds, too
 * dark to read as dots on aerial imagery.
 */
const TAKEOFF_COLOR = '#22a95c';
const LANDING_COLOR = '#e0483a';

@Component({
    selector: 'fb-igc-map',
    templateUrl: './igc-map.component.html',
    styleUrls: ['./igc-map.component.scss'],
    imports: [
        TranslateModule,
        IonRange,
        IonButton,
        IonIcon
    ]
})
export class IgcMapComponent implements AfterViewInit, OnDestroy {

    // Guarded by @if (igcFileValue) in the template, so it only resolves once a
    // track exists - which is also what keeps OpenLayers from sizing itself
    // against a 0x0 container.
    @ViewChild('mapEl') mapEl: ElementRef<HTMLDivElement>;

    igcFileValue: string;
    inputValue = 0;
    sliderInfo: any;
    playing = false;

    public readonly varioGradient = varioGradientCss();

    private styleCache: { [step: number]: Style[] } = {};
    /** Raw track: one feature, used for the time range, extent and casing. */
    private vectorSource = new VectorSource();
    /** Same track split into runs of one ramp step, for colouring. */
    private varioSource = new VectorSource();
    /** Take-off and landing dots. */
    private endpointSource = new VectorSource();
    private vectorSourceOverlay = new VectorSource();
    private time: any;
    private casingLayer: VectorLayer<any>;
    private vectorLayer: VectorLayer<any>;
    private endpointLayer: VectorLayer<any>;
    private featureOverlay: VectorLayer<any>;
    private map: Map;
    private geometry: LineString;
    private igcParserValue: any;
    /** Fix timestamps in seconds, ascending - the binary search index. */
    private fixSeconds: number[] = [];
    private animationHandle: number | null = null;
    private playStartedAt = 0;
    private playFromFraction = 0;
    private lastSyncAt = 0;

    @Input()
    set igcFile(val: string) {
        this.igcFileValue = val
        const igcFormat = new IGC();
        if (typeof val === 'string') {
            this.igcParserValue = IGCParser.parse(val, { lenient: true });
            this.fixSeconds = (this.igcParserValue.fixes ?? []).map((fix: any) => fix.timestamp / 1000);

            // altitudeMode is deliberately left at its default ('none') so the
            // geometry layout stays XYM and coordinate index 2 remains the
            // timestamp. OL 9's IGC reader also maps 'gps'/'barometric' to the
            // wrong B-record fields, so altitude comes from igc-parser instead.
            const features = igcFormat.readFeatures(val, {
                featureProjection: 'EPSG:3857',
            });

            // Guarded: ol's IGC reader returns [] for a track whose B-records
            // are unreadable (a truncated upload, a file that is not really
            // IGC), and this runs inside an @Input setter - so the TypeError
            // aborted the flight form's change-detection pass instead of just
            // leaving the map out. It is also what made the `!this.geometry`
            // branches below reachable.
            this.geometry = (features[0]?.getGeometry() as LineString) ?? null;

            if (this.vectorSource) {
                this.vectorSource.clear();
                this.time = {
                    start: Infinity,
                    stop: -Infinity,
                    duration: 0,
                };
                this.vectorSource.addFeatures(features);
            }

            this.buildVarioTrack();

            if (this.vectorSourceOverlay) {
                this.vectorSourceOverlay.clear();
                this.stop();
                this.inputValue = 0;
                this.sliderInfo = null;
            }

            if (this.map) {
                this.mapCenter();
            }
        }
    }

    constructor(
        private configurationService: ConfigurationService,
        private zone: NgZone,
        private cdr: ChangeDetectorRef
    ) {
        this.vectorSource.on('addfeature', this.onAddfeature);

        /*
         * The casing is the whole track in one dark stroke on its own layer,
         * not a second style per coloured run: runs are short now, and a
         * per-run casing painted over the neighbour that was drawn before it,
         * breaking the line into dashes.
         */
        this.casingLayer = new VectorLayer({
            source: this.vectorSource,
            style: new Style({
                stroke: new Stroke({ color: withAlpha(themeColor('--fb-text', '#10293c'), 0.38), width: 7 })
            })
        });

        this.vectorLayer = new VectorLayer({
            source: this.varioSource,
            style: this.styleFunction,
        });

        this.endpointLayer = new VectorLayer({
            source: this.endpointSource,
            style: this.endpointStyle,
        });

        addIcons({ play, pause });
    }

    /** Resolves once initMap() has settled, so teardown can wait for it. */
    private ready?: Promise<void>;
    private destroyed = false;

    ngAfterViewInit() {
        // Kept, and caught: the map configuration is an HTTP call, so a failure
        // here would otherwise surface as an unhandled promise rejection.
        this.ready = this.initMap().catch(error => console.warn('Map unavailable', error));
    }

    ngOnDestroy() {
        this.destroyed = true;
        // Without this the replay loop keeps running after navigation.
        this.stop();
        // And without this the map holds its WebGL context: browsers cap those
        // at around 16, so opening that many IGC tracks in one session started
        // blanking the earliest maps. Deferred until initMap has settled -
        // leaving before the config request returned used to dispose nothing
        // and then build a Map against a detached element.
        const dispose = () => {
            this.map?.setTarget(undefined);
            this.map?.dispose();
        };
        this.ready ? this.ready.then(dispose, dispose) : dispose();
    }

    /** The playback controls are live as soon as the track parses, but they drive the map. */
    public get mapReady(): boolean {
        return !!this.map && !!this.featureOverlay;
    }

    onAddfeature = ((evt: any) => {
        const geometry = evt.feature.getGeometry() as LineString;
        this.time.start = Math.min(this.time.start, geometry.getFirstCoordinate()[2]);
        this.time.stop = Math.max(this.time.stop, geometry.getLastCoordinate()[2]);
        this.time.duration = this.time.stop - this.time.start;
    });

    /**
     * ion-range echoes programmatic [value] changes back as ionInput, so this
     * must NOT stop playback - doing so made the replay kill itself on its own
     * first frame. Genuine user drags come in via ionKnobMoveStart instead.
     */
    onTimeSliderInput($event: any) {
        const fraction = $event.target.value / 100;
        // Ignore the echo of our own update while playing.
        if (this.playing && Math.abs(fraction - this.inputValue) < 0.001) {
            return;
        }
        this.seek(fraction);
    }

    /** A real drag on the knob takes over from playback. */
    onKnobMoveStart() {
        this.stop();
    }

    togglePlay() {
        if (this.playing) {
            this.stop();
        } else {
            this.play();
        }
    }

    /** Move the marker and readout to a fraction (0..1) of the flight. */
    seek(fraction: number) {
        // mapReady as well as time: the template renders play and the slider as
        // soon as the track is parsed, but map/featureOverlay only exist after
        // initMap's awaited configuration request has returned.
        if (!this.time || !this.time.duration || !this.mapReady) {
            return;
        }

        this.inputValue = fraction;
        const m = this.time.start + this.time.duration * fraction;
        this.sliderInfo = this.findFixAt(m);

        this.vectorSource.forEachFeature(feature => {
            const geometry = (feature.getGeometry() as LineString);
            const coordinate = geometry.getCoordinateAtM(m, true);
            let highlight = feature.get('highlight');
            if (highlight === undefined) {
                highlight = new Feature(new Point(coordinate));
                feature.set('highlight', highlight);
                this.featureOverlay.getSource().addFeature(highlight);
            } else {
                highlight.getGeometry().setCoordinates(coordinate);
            }
        });

        this.map.render();
    }

    private play() {
        if (!this.time || !this.time.duration || !this.mapReady) {
            return;
        }
        // Restart from the top once the previous run has finished.
        this.playFromFraction = this.inputValue >= 1 ? 0 : this.inputValue;
        this.playStartedAt = performance.now();
        this.lastSyncAt = 0;
        this.playing = true;
        // Outside Angular: a 60fps loop would otherwise run change detection on
        // every frame for the whole replay. Bindings are synced on a throttle.
        this.zone.runOutsideAngular(() => {
            this.animationHandle = requestAnimationFrame(this.tick);
        });
    }

    private stop() {
        if (this.animationHandle !== null) {
            cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
        }
        if (this.playing) {
            this.playing = false;
            this.syncBindings();
        }
    }

    private tick = (now: number) => {
        const elapsed = now - this.playStartedAt;
        const fraction = this.playFromFraction + elapsed / REPLAY_DURATION_MS;

        if (fraction >= 1) {
            this.seek(1);
            this.stop();
            return;
        }

        this.seek(fraction);

        // The marker moves every frame; the slider and readout only need to
        // keep up with the eye.
        if (now - this.lastSyncAt > BINDING_SYNC_MS) {
            this.lastSyncAt = now;
            this.syncBindings();
        }

        this.animationHandle = requestAnimationFrame(this.tick);
    };

    private syncBindings() {
        this.zone.run(() => this.cdr.detectChanges());
    }

    /**
     * Nearest fix to a timestamp, by binary search.
     *
     * The previous implementation matched an ISO HH:MM:SS string against
     * fix.time, which returned undefined for any second the logger skipped -
     * survivable while scrubbing by hand, but playback lands on those
     * constantly.
     */
    private findFixAt(seconds: number): any {
        const fixes = this.igcParserValue?.fixes;
        if (!fixes || fixes.length === 0) {
            return null;
        }

        let low = 0;
        let high = this.fixSeconds.length - 1;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (this.fixSeconds[mid] < seconds) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        // `low` is the first fix at or after `seconds`; the one before it may be closer.
        if (low > 0 && Math.abs(this.fixSeconds[low - 1] - seconds) < Math.abs(this.fixSeconds[low] - seconds)) {
            low = low - 1;
        }
        return fixes[low];
    }

    /**
     * Split the track into runs of one ramp step, so the line can be drawn in
     * climb/sink colours. Consecutive fixes on the same step collapse into one
     * LineString - on the order of 1500 features for a two-hour flight, each
     * carrying a single stroke now that the casing is its own layer.
     */
    private buildVarioTrack() {
        this.varioSource.clear();

        const fixes = this.igcParserValue?.fixes ?? [];
        if (fixes.length < 2 || !this.geometry) {
            // No usable vario - fall back to drawing the raw track.
            this.varioSource.addFeatures(
                this.geometry ? [new Feature({ geometry: this.geometry, varioStep: NEUTRAL_STEP })] : []
            );
            this.buildEndpoints();
            return;
        }

        // Projected coordinates, so the runs line up with the rendered track.
        const coordinates = this.geometry.getCoordinates();
        const altitudes: number[] = fixes.map((fix: any) => fix.pressureAltitude ?? fix.gpsAltitude ?? 0);
        const seconds = this.fixSeconds;

        const raw: number[] = new Array(fixes.length).fill(0);
        for (let i = 1; i < fixes.length; i++) {
            const dt = seconds[i] - seconds[i - 1];
            raw[i] = dt > 0 ? (altitudes[i] - altitudes[i - 1]) / dt : 0;
        }

        // Raw per-fix vario is far too noisy to colour; average over a window.
        const smoothed: number[] = new Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - VARIO_SMOOTHING); j <= Math.min(raw.length - 1, i + VARIO_SMOOTHING); j++) {
                sum += raw[j];
                count++;
            }
            smoothed[i] = sum / count;
        }

        const limit = Math.min(coordinates.length, smoothed.length);
        let runStart = 0;
        let runStep = varioStepIndex(smoothed[0]);

        for (let i = 1; i < limit; i++) {
            const step = varioStepIndex(smoothed[i]);
            if (step !== runStep) {
                // Include the current point so runs join seamlessly.
                this.addVarioRun(coordinates.slice(runStart, i + 1), runStep);
                runStart = i;
                runStep = step;
            }
        }
        this.addVarioRun(coordinates.slice(runStart, limit), runStep);

        this.buildEndpoints();
    }

    private addVarioRun(coordinates: number[][], step: number) {
        if (coordinates.length < 2) {
            return;
        }
        this.varioSource.addFeature(new Feature({
            geometry: new LineString(coordinates),
            varioStep: step
        }));
    }

    /** Where the track starts and where it ends, as the two dots on the map. */
    private buildEndpoints() {
        this.endpointSource.clear();
        if (!this.geometry) {
            return;
        }
        this.endpointSource.addFeatures([
            new Feature({ geometry: new Point(this.geometry.getFirstCoordinate()), endpoint: 'start' }),
            new Feature({ geometry: new Point(this.geometry.getLastCoordinate()), endpoint: 'end' })
        ]);
    }

    private styleFunction = (feature: any) => {
        const step: number = feature.get('varioStep') ?? NEUTRAL_STEP;
        let style = this.styleCache[step];
        if (!style) {
            // Colour only - .casingLayer carries the track's outline for all
            // of the runs at once, one layer below this one.
            style = [new Style({ stroke: new Stroke({ color: varioStepColor(step), width: 3.4 }) })];
            this.styleCache[step] = style;
        }
        return style;
    };

    /*
     * The replay marker covers whichever of these it sits on - it is drawn on an
     * unmanaged layer, so it is always on top. That is the marker saying where
     * the pilot is, and no radius short of a conspicuously large dot gets the
     * fill out from under it: the marker is opaque to 7.25, and a dot of radius
     * r only shows colour out to r - 1.25.
     */
    private endpointStyle = (feature: any) => new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: feature.get('endpoint') === 'start' ? TAKEOFF_COLOR : LANDING_COLOR }),
            stroke: new Stroke({ color: themeColor('--fb-surface', '#ffffff'), width: 2.5 })
        })
    });

    private async initMap() {
        const config = await firstValueFrom(this.configurationService.getMapConfiguration());
        if (this.destroyed) {
            return;
        }
        const attributionControl = new Attribution({
            collapsible: true,
            collapsed: true
        })

        const layers: any[] = [
            new TileLayer({
                source: new OSM({
                    url: config.url,
                    attributions: config.attributions,
                    crossOrigin: config.crossOrigin
                })
            })
        ];

        const relief = this.createReliefLayer(config.terrainUrl, config.terrainAttributions);
        if (relief) {
            layers.push(relief);
        }
        layers.push(this.casingLayer, this.vectorLayer, this.endpointLayer);

        this.map = new Map({
            layers,
            controls: [attributionControl],
            // Element ref rather than the id "map": PlaceMapComponent uses the
            // same id, so a shared id would bind whichever map rendered first.
            target: this.mapEl.nativeElement,
            view: new View(),
        });

        this.mapCenter();

        this.featureOverlay = new VectorLayer({
            source: this.vectorSourceOverlay,
            map: this.map,
            style: new Style({
                image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({
                        color: themeColor('--fb-text', '#10293c'),
                    }),
                    stroke: new Stroke({
                        color: themeColor('--fb-surface', '#ffffff'),
                        width: 2.5
                    })
                }),
            }),
        });
    }

    /**
     * Hillshade from terrarium-encoded elevation tiles, after the OpenLayers
     * WebGL shaded relief example. Returns null when the API sends no terrain
     * URL or the device has no usable WebGL context, in which case the plain
     * basemap is used on its own.
     */
    private createReliefLayer(terrainUrl?: string, terrainAttributions?: string): WebGLTileLayer | null {
        if (!terrainUrl) {
            return null;
        }

        try {
            const elevation = (xOffset: number, yOffset: number): any[] => {
                const red = ['band', 1, xOffset, yOffset];
                const green = ['band', 2, xOffset, yOffset];
                const blue = ['band', 3, xOffset, yOffset];
                // Terrarium encoding: (256*R + G + B/256) - 32768 metres.
                return ['+', ['*', 255 * 256, red], ['*', 255, green], ['*', 255 / 256, blue], -32768];
            };

            const dp = ['*', 2, ['resolution']];
            const z0x = ['*', ['var', 'vert'], elevation(-1, 0)];
            const z1x = ['*', ['var', 'vert'], elevation(1, 0)];
            const dzdx = ['/', ['-', z1x, z0x], dp];
            const z0y = ['*', ['var', 'vert'], elevation(0, -1)];
            const z1y = ['*', ['var', 'vert'], elevation(0, 1)];
            const dzdy = ['/', ['-', z1y, z0y], dp];
            const slope = ['atan', ['sqrt', ['+', ['^', dzdx, 2], ['^', dzdy, 2]]]];
            const aspect = ['clamp', ['atan', ['-', 0, dzdx], dzdy], -Math.PI, Math.PI];
            const sunEl = ['*', Math.PI / 180, ['var', 'sunEl']];
            const sunAz = ['*', Math.PI / 180, ['var', 'sunAz']];

            const cosIncidence = [
                '+',
                ['*', ['sin', sunEl], ['cos', slope]],
                ['*', ['cos', sunEl], ['sin', slope], ['cos', ['-', sunAz, aspect]]],
            ];
            const scaled = ['*', 255, cosIncidence];

            return new WebGLTileLayer({
                opacity: 0.3,
                source: new XYZ({
                    url: terrainUrl,
                    maxZoom: 15,
                    attributions: terrainAttributions,
                    // Required: WebGL cannot sample a cross-origin-tainted texture.
                    crossOrigin: 'anonymous'
                }),
                style: {
                    variables: { vert: 1, sunEl: 45, sunAz: 45 },
                    color: ['color', scaled],
                },
            });
        } catch (e) {
            // Only catches building the layer. A WebGL context is not created
            // until the first render, so a device that cannot provide one fails
            // later and elsewhere - this is not that safety net.
            console.warn('Shaded relief unavailable', e);
            return null;
        }
    }

    private mapCenter() {
        if (!this.map || !this.geometry) {
            return;
        }
        this.map.getView().fit(this.geometry.getExtent());
        const zoom = this.map.getView().getZoom();
        this.map.getView().setZoom(zoom - 1);
    }
}
