/**
 * Continuous colour ramp for vertical speed: blue sinking, green around zero,
 * red climbing. The scale every track viewer a pilot already uses draws - the
 * flight is read at a glance for where the lift was, not measured off the map.
 *
 * Deliberately multi-hue, where a general chart would take two hues around a
 * neutral gray: the convention is worth more here than the lightness ordering,
 * since the ends are what carry meaning and both are dark. The dark casing the
 * map draws under the line covers the rest - the pale middle of the ramp has
 * no contrast of its own against a light basemap.
 */

/** The ramp saturates here; beyond it, colour stops carrying information. */
export const VARIO_MIN = -5;
export const VARIO_MAX = 5;

/**
 * The track is drawn as runs of one colour, so the ramp is quantised: enough
 * steps to read as a gradient, few enough to stay in the low thousands of line
 * features on a long flight - a two-hour one lands around 1500. Raise this and
 * the replay is what pays for it, a frame redrawing every run.
 */
export const VARIO_STEPS = 24;

/*
 * Bare Math.min/max would carry a NaN through to an rgb(NaN, ...) stroke, which
 * paints nothing - a stretch of track would be missing rather than mis-coloured.
 * An infinity still means the end of the ramp; only an unknown lands mid-ramp.
 */
function clamp(vario: number): number {
    const value = Number(vario);
    if (!Number.isFinite(value)) {
        return value > 0 ? VARIO_MAX : value < 0 ? VARIO_MIN : 0;
    }
    return Math.min(VARIO_MAX, Math.max(VARIO_MIN, value));
}

interface VarioStop {
    /** Vertical speed in m/s. */
    at: number;
    rgb: [number, number, number];
}

const STOPS: VarioStop[] = [
    { at: -5.0, rgb: [21, 82, 184] },
    { at: -3.0, rgb: [43, 143, 214] },
    { at: -1.5, rgb: [63, 201, 201] },
    { at: -0.4, rgb: [90, 200, 120] },
    { at: 0.4, rgb: [162, 205, 70] },
    { at: 1.5, rgb: [242, 196, 61] },
    { at: 3.0, rgb: [240, 138, 44] },
    { at: 5.0, rgb: [214, 59, 42] }
];

/** The ramp's colour at a vertical speed, interpolated between its stops. */
export function varioColor(vario: number): string {
    const value = clamp(vario);

    let lower = STOPS[0];
    let upper = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
        if (value >= STOPS[i].at && value <= STOPS[i + 1].at) {
            lower = STOPS[i];
            upper = STOPS[i + 1];
            break;
        }
    }

    const span = upper.at - lower.at;
    const t = span > 0 ? (value - lower.at) / span : 0;
    const channel = (index: number) => Math.round(lower.rgb[index] + (upper.rgb[index] - lower.rgb[index]) * t);
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** Which of the VARIO_STEPS bands a vertical speed falls in. */
export function varioStepIndex(vario: number): number {
    const fraction = (clamp(vario) - VARIO_MIN) / (VARIO_MAX - VARIO_MIN);
    return Math.min(VARIO_STEPS - 1, Math.floor(fraction * VARIO_STEPS));
}

/** The colour of a band, taken at its midpoint. */
export function varioStepColor(step: number): string {
    const width = (VARIO_MAX - VARIO_MIN) / VARIO_STEPS;
    return varioColor(VARIO_MIN + width * (step + 0.5));
}

/** The whole ramp as a CSS gradient, for the legend bar. */
export function varioGradientCss(): string {
    const stops = STOPS.map(stop => {
        const position = ((stop.at - VARIO_MIN) / (VARIO_MAX - VARIO_MIN)) * 100;
        return `${varioColor(stop.at)} ${position.toFixed(1)}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}
