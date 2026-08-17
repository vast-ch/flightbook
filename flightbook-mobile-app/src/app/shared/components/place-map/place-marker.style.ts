import Icon from 'ol/style/Icon';
import Style from 'ol/style/Style';

/** Pin geometry, in the SVG's own units. Also the Icon's declared size. */
const PIN_WIDTH = 26;
const PIN_HEIGHT = 34;

/** Only a literal colour can go into the SVG; see accentColor below. */
const LITERAL_COLOR = /^(#|rgb|hsl)/;

/**
 * Drawn inline rather than loaded from a file. The previous style pointed at
 * assets/icon/marker.png, which has never existed in this repository - so every
 * place, new or saved, drew an invisible marker while the geometry underneath it
 * was perfectly correct. An inline SVG cannot 404.
 */
function pinSvg(color: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 26 34">`
        + `<path d="M13 33S25 20.6 25 13A12 12 0 1 0 1 13c0 7.6 12 20 12 20z" fill="${color}" stroke="#ffffff" stroke-width="2"/>`
        + `<circle cx="13" cy="13" r="4.5" fill="#ffffff"/>`
        + `</svg>`;
}

/**
 * The theme is the source of truth for the colour, but a canvas cannot resolve a
 * CSS custom property - so it is read once here.
 *
 * getPropertyValue hands back the token's text unresolved: were --fb-accent ever
 * redefined as `var(--something-else)`, that text would land in the SVG's fill
 * attribute and paint nothing. Only a literal colour is accepted.
 */
function accentColor(): string {
    const fallback = '#45b1fd';
    if (typeof document === 'undefined') {
        return fallback;
    }
    const token = getComputedStyle(document.documentElement).getPropertyValue('--fb-accent').trim();
    return LITERAL_COLOR.test(token) ? token : fallback;
}

/**
 * The pin drawn at a place's coordinates.
 *
 * Separate from the component so its image can be asserted on: nothing in the
 * DOM reveals whether a canvas marker appeared.
 */
export function createMarkerStyle(): Style {
    return new Style({
        image: new Icon({
            // The tip, not the middle - the pin has to point at the place.
            anchor: [0.5, 1],
            // Declared rather than measured. Without it OpenLayers waits for the
            // image to load before it knows the icon's dimensions, so getSize()
            // and getAnchor() answer null until the first render - a needless
            // deferral for an image that is already inline, and one that cannot
            // be asserted on.
            size: [PIN_WIDTH, PIN_HEIGHT],
            src: `data:image/svg+xml,${encodeURIComponent(pinSvg(accentColor()))}`,
        })
    });
}
