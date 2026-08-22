import { describe, expect, it } from 'vitest';
import { render } from '~/test/render';
import Footer from './Footer.astro';

const cta = {
  title: 'Die ersten 25 Flüge sind gratis.',
  button: 'Jetzt kostenlos starten',
  href: 'https://m.flightbook.ch/register',
};

const columns = [
  { title: 'Open Source', links: [{ text: 'GitHub', href: 'https://github.com/vast-ch/flightbook' }] },
  { title: 'Legal', links: [{ text: 'Datenschutz', href: '/en/privacy-policy' }] },
];

/** Extracts the first `<a href="{href}" ...>...</a>` tag (lazy, so it stops at the matching close). */
function anchorWithHref(html: string, href: string): string | undefined {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>[\\s\\S]*?</a>`))?.[0];
}

describe('Footer', () => {
  it("renders the CTA band's title and a button linking to cta.href", async () => {
    const html = await render(Footer, { cta, columns });

    expect(html).toContain(cta.title);
    const button = anchorWithHref(html, cta.href);
    expect(button).toBeDefined();
    expect(button).toContain(cta.button);
  });

  it('renders both link columns with their titles and every link text/href', async () => {
    const html = await render(Footer, { cta, columns });

    for (const column of columns) {
      expect(html).toContain(column.title);
      for (const link of column.links) {
        const anchor = anchorWithHref(html, link.href);
        expect(anchor).toBeDefined();
        expect(anchor).toContain(link.text);
      }
    }
  });

  it('emits a locale-prefixed privacy href unchanged, without re-prefixing it', async () => {
    const html = await render(Footer, { cta, columns });

    expect(html).toContain('href="/en/privacy-policy"');
    expect(html).not.toContain('/en/en/privacy-policy');
  });

  it('renders with no socialLinks/secondaryLinks/footNote props and no scroll-reveal classes', async () => {
    const html = await render(Footer, { cta, columns });

    expect(html).not.toContain('intersect-once');
    expect(html).not.toMatch(/motion-safe:/);
  });

  // N4 REGRESSION: the footer logo used getHomePermalink() -> '/' unconditionally, so a French
  // or English visitor's logo click always landed on the German homepage. It must follow
  // currentLocale the same way Header.astro's logo link does (N3), and default to German when
  // no locale is passed, so existing callers that omit it are unaffected.
  it("links the logo to the current locale's home, defaulting to German", async () => {
    const de = await render(Footer, { cta, columns });
    const fr = await render(Footer, { cta, columns, currentLocale: 'fr' });
    const en = await render(Footer, { cta, columns, currentLocale: 'en' });

    expect(de).toContain('href="/" class="flex items-center gap-[10px] text-white"');
    expect(fr).toContain('href="/fr" class="flex items-center gap-[10px] text-white"');
    expect(en).toContain('href="/en" class="flex items-center gap-[10px] text-white"');
  });
});
