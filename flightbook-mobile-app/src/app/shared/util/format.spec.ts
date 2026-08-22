import { dateRangeLabel, localDate, shortDate } from './format';

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

/**
 * Both filter chip rows draw their period from this. They used to carry a copy
 * each and the copies disagreed: a whole calendar year read as "2025" on
 * Flights and as "01.01.2025 - 31.12.2025" on the appointment list.
 */
describe('dateRangeLabel', () => {

    const translate = (key: string) => key === 'filter.from' ? 'From' : 'To';

    it('collapses a whole calendar year to the year', () => {
        expect(dateRangeLabel(new Date(2025, 0, 1), new Date(2025, 11, 31), translate)).toBe('2025');
    });

    it('spans two dates that are not a whole year', () => {
        expect(dateRangeLabel(new Date(2025, 2, 4), new Date(2025, 5, 9), translate))
            .toBe('04.03.2025 \u2013 09.06.2025');
    });

    it('names the one bound that is set', () => {
        expect(dateRangeLabel(new Date(2026, 7, 14), null, translate)).toBe('From 14.08.2026');
        expect(dateRangeLabel(null, new Date(2026, 7, 14), translate)).toBe('To 14.08.2026');
    });

    /** A year's ends in different years is a range, not that year. */
    it('does not collapse a range whose ends fall in different years', () => {
        expect(dateRangeLabel(new Date(2024, 0, 1), new Date(2025, 11, 31), translate))
            .toBe('01.01.2024 \u2013 31.12.2025');
    });
});

describe('shortDate', () => {

    it('pads day and month', () => {
        expect(shortDate(new Date(2025, 0, 2))).toBe('02.01.2025');
    });

    it('is empty for nothing, and for a date it cannot read', () => {
        expect(shortDate(null)).toBe('');
        expect(shortDate(undefined)).toBe('');
        expect(shortDate(new Date(NaN))).toBe('');
    });
});
