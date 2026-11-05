/**
 * Design tokens for the canvas APIs.
 *
 * Chart.js and OpenLayers paint on a canvas, which cannot resolve a CSS custom
 * property - so the colours they take had been hand-copied out of the theme,
 * and `#45b1fd` alone stood in four TypeScript files. These read the token
 * instead, leaving theme/tokens.scss the one place a palette change happens.
 *
 * The fallbacks are for a document without the stylesheet - a unit test, or a
 * renamed token - not a second definition: whenever the sheet is there, it wins.
 */

/**
 * getPropertyValue hands back the token's text unresolved: were a token ever
 * redefined as `var(--something-else)`, that text would reach a fill attribute
 * and paint nothing. Only a literal colour is accepted.
 */
const LITERAL_COLOR = /^(#|rgb|hsl)/;

/** Read once per token: the theme does not change while the app is running. */
const cache = new Map<string, string>();

export function themeColor(token: string, fallback: string): string {
    const cached = cache.get(token);
    if (cached !== undefined) {
        return cached;
    }
    if (typeof document === 'undefined') {
        return fallback;
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    const colour = LITERAL_COLOR.test(value) ? value : fallback;
    cache.set(token, colour);
    return colour;
}

/**
 * The same colour, translucent - for a chart's fill under its line, where the
 * theme has the hue but not the wash.
 */
export function withAlpha(color: string, alpha: number): string {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
    if (!hex) {
        return color;
    }
    const digits = hex[1].length === 3
        ? hex[1].split('').map(digit => digit + digit).join('')
        : hex[1];
    const value = parseInt(digits, 16);
    /* eslint-disable no-bitwise */
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
    /* eslint-enable no-bitwise */
}
