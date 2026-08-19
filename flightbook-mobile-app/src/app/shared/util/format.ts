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
 * Parses a YYYY-MM-DD date from the API as local midnight.
 *
 * `new Date('2025-01-01')` is parsed as UTC, so west of UTC it lands on the
 * previous day - while Angular's DatePipe parses the same string as local. Mix
 * the two on one screen and the row says 1 March under a February heading.
 */
export function localDate(value: string): Date {
    // The API is not consistent about this: a flight's date arrives as
    // "2025-01-02", a passenger confirmation's as "2024-01-01T00:00:00.000Z".
    // Splitting the timestamp on '-' alone left "01T00:00:00.000Z" as the day,
    // which is NaN - and an Invalid Date thrown by a DatePipe takes the whole
    // page's change detection with it. The calendar day is all this needs.
    const [year, month, day] = String(value ?? '').split('T')[0].split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Distance split the same way: no decimal once it stops fitting. */
export function splitDistance(km: number): { value: string; unit: string } {
    const distance = Number(km ?? 0);
    return { value: distance >= 100 ? distance.toFixed(0) : distance.toFixed(1), unit: 'km' };
}
