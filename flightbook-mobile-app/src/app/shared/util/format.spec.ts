import { localDate } from './format';

/**
 * The API sends this field in two shapes - a flight's "2025-01-02" and a
 * passenger confirmation's "2024-01-01T00:00:00.000Z" - and a month heading
 * built from the wrong one either crashes the page's DatePipe or files the row
 * under the wrong month. These assert the calendar day survives both.
 */
describe('localDate', () => {

    const asDay = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    it('reads a date-only string as its own calendar day', () => {
        expect(asDay(localDate('2025-01-02'))).toBe('2025-01-02');
    });

    /** The regression this guards: splitting on '-' alone left "01T00:00..." as the day. */
    it('reads a UTC-midnight timestamp as the day it names, not the day before', () => {
        expect(asDay(localDate('2024-01-01T00:00:00.000Z'))).toBe('2024-01-01');
    });

    it('takes the calendar day from a Date as-is', () => {
        expect(asDay(localDate(new Date(2026, 7, 18)))).toBe('2026-08-18');
    });

    /** Silently inventing 1 Jan 1900 out of '' is worse than admitting defeat. */
    it('returns an Invalid Date for input it cannot read', () => {
        for (const value of ['', 'not-a-date', null as unknown as string, undefined as unknown as string]) {
            expect(isNaN(localDate(value).getTime()))
                .withContext(`expected an Invalid Date for ${JSON.stringify(value)}`).toBe(true);
        }
    });
});
