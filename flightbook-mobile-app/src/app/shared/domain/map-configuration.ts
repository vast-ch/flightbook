export class MapConfiguration {
    readonly url: string;
    readonly attributions: string;
    readonly crossOrigin: string;
    /**
     * Terrain-RGB tiles for the hillshaded relief layer. Optional: an older API
     * won't send these, and the map falls back to the plain basemap.
     */
    readonly terrainUrl?: string;
    readonly terrainAttributions?: string;
}
