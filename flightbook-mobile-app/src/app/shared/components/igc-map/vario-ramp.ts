/**
 * Diverging colour ramp for vertical speed, red for climbing and blue for
 * sinking (variometer convention).
 *
 * Two hues with a neutral gray midpoint - never a hue at the middle. The arms
 * are lightness-monotonic away from the neutral (OKLab L 0.419 / 0.600 / 0.682
 * / 0.599 / 0.472), which is what makes a diverging ramp readable as ordered.
 */
export interface VarioBin {
    /** Lower bound in m/s, inclusive. -Infinity for the first bin. */
    min: number;
    color: string;
    /** i18n key for the legend / accessible description. */
    labelKey: string;
}

export const VARIO_BINS: VarioBin[] = [
    { min: -Infinity, color: '#08517f', labelKey: 'flight.vario.strongSink' },
    { min: -3, color: '#2e86c8', labelKey: 'flight.vario.sink' },
    { min: -1, color: '#8c9ba8', labelKey: 'flight.vario.neutral' },
    { min: 1, color: '#cc5540', labelKey: 'flight.vario.climb' },
    { min: 3, color: '#a32718', labelKey: 'flight.vario.strongClimb' }
];

/** Index into VARIO_BINS for a vertical speed in m/s. */
export function varioBinIndex(vario: number): number {
    let index = 0;
    for (let i = 0; i < VARIO_BINS.length; i++) {
        if (vario >= VARIO_BINS[i].min) {
            index = i;
        }
    }
    return index;
}
