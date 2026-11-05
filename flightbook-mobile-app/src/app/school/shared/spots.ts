/**
 * Capacity of an appointment, as the design draws it: one cell per spot, filled
 * for the taken ones and all red once there are none left. Shared by the list
 * row and the detail card, which differ only in cell width.
 */

/** Beyond this the bar stops being readable, so callers show only the count. */
const MAX_SPOT_CELLS = 20;

export type SpotCell = 'taken' | 'free' | 'full';

export function isFull(taken: number, total: number): boolean {
    return !!total && taken >= total;
}

export function freeSpots(taken: number, total: number): number {
    return Math.max(0, (total ?? 0) - (taken ?? 0));
}

export function spotCells(taken: number, total: number): SpotCell[] {
    if (!total || total > MAX_SPOT_CELLS) {
        return [];
    }
    const full = isFull(taken, total);
    const filled = Math.min(total, taken ?? 0);
    return Array.from({ length: total }, (_unused, index) =>
        full ? 'full' : (index < filled ? 'taken' : 'free')
    );
}
