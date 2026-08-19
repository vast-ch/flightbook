/**
 * The display formats the redesigned screens share.
 *
 * Home, Statistics and the Flights list each grew their own copy of these, and
 * they had already drifted: the same sub-hour airtime read "45 m" on Home and
 * "45 min" on Statistics. One place, so the next tweak lands everywhere.
 */

/** Seconds to HH:mm - the headline and chart-footer format. */
export function toHoursMinutes(seconds: number): string {
    const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Airtime split into value and unit so the unit can be styled smaller:
 * whole minutes under an hour, then hours with one decimal.
 */
export function splitDuration(seconds: number): { value: string; unit: string } {
    const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
    if (total < 3600) {
        return { value: `${Math.round(total / 60)}`, unit: 'min' };
    }
    return { value: (total / 3600).toFixed(1), unit: 'h' };
}

/**
 * Reads the calendar day out of an API date and returns it as local midnight,
 * so a month heading built from it agrees with the DatePipe rendering the row.
 *
 * `new Date('2025-01-01')` is parsed as UTC, so west of UTC it lands on the
 * previous day - while Angular's DatePipe parses the same string as local. Mix
 * the two on one screen and the row says 1 March under a February heading.
 *
 * Unreadable input yields an Invalid Date rather than a plausible one: the
 * arithmetic form silently turned '' into the year 1900, because `Number('')`
 * is 0 and `new Date(0, ...)` maps years 0-99 into the 1900s.
 */
export function localDate(value: string | Date): Date {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/.exec(String(value ?? ''));
    if (!match) {
        return new Date(NaN);
    }
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month ?? 1) - 1, Number(day ?? 1));
}

/** Distance split the same way: no decimal once it stops fitting. */
export function splitDistance(km: number): { value: string; unit: string } {
    const distance = Number(km ?? 0);
    return { value: distance >= 100 ? distance.toFixed(0) : distance.toFixed(1), unit: 'km' };
}
