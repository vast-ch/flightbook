import { describe, expect, it } from 'vitest';
import { getHeaderData, getFooterData } from '~/navigation';

describe('getHeaderData', () => {
  it('returns the five frozen nav links, in order, for de', () => {
    const { links } = getHeaderData('de');

    expect(links).toHaveLength(5);
    expect(links.map((l) => l.href)).toEqual(['/#premium', '/#angebot', '/#schools', '/#tandem', '/#faq']);
  });

  it('prefixes hrefs for fr and en, but not for de', () => {
    expect(getHeaderData('fr').links[0].href).toMatch(/^\/fr/);
    expect(getHeaderData('en').links[0].href).toMatch(/^\/en/);
    expect(getHeaderData('de').links[0].href).not.toMatch(/^\/(fr|en)/);
  });

  it('exposes two login links pointing at the pilot and instructor apps', () => {
    const { login } = getHeaderData('de');

    expect(login.links).toHaveLength(2);
    expect(login.links.some((l) => l.href.includes('m.flightbook.ch'))).toBe(true);
    expect(login.links.some((l) => l.href.includes('instructor.flightbook.ch'))).toBe(true);
  });

  it('reads link text from the locale table rather than hard-coding it', () => {
    const de = getHeaderData('de');
    const en = getHeaderData('en');

    expect(de.links[0].text).not.toBe(en.links[0].text);
  });
});

describe('getFooterData', () => {
  it('prefixes the legal column link with the locale', () => {
    const { columns } = getFooterData('en');

    expect(columns[1].links[0].href).toBe('/en/privacy-policy');
  });
});
