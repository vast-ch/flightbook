import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from '~/test/render';
import Header from './Header.astro';
import type { Locale } from '~/utils/i18n';

const data = {
  links: [
    { text: 'Funktionalitäten', href: '/#premium' },
    { text: 'Pricing', href: '/#angebot' },
    { text: 'Schools', href: '/#schools' },
    { text: 'Tandem', href: '/#tandem' },
    { text: 'FAQ', href: '/#faq' },
  ],
  login: {
    text: 'Login',
    links: [
      { text: 'Flightbook', sub: 'Für Pilot*innen', href: 'https://m.flightbook.ch', icon: 'wing' as const },
      {
        text: 'Flightbook Schools',
        sub: 'Für Flugschulen',
        href: 'https://instructor.flightbook.ch',
        icon: 'cap' as const,
      },
    ],
  },
  action: { text: 'Registrieren', href: 'https://m.flightbook.ch/register' },
};

/**
 * Minimal, self-contained HTML-to-tree parser used only by this test file. We can't reach for
 * jsdom/cheerio (not a project dependency, and vitest's `environment` is plain `node`), but the
 * regression below is inherently structural — it has to walk real parent/child relationships,
 * not just grep for substrings — so a tiny purpose-built tree builder is the pragmatic tool here.
 */
interface Node {
  tag: string;
  attrs: string;
  children: Node[];
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function parseHtml(html: string): Node[] {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/)?>/g;
  const roots: Node[] = [];
  const stack: Node[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(clean))) {
    const isClosing = match[0].startsWith('</');
    const tag = match[1].toLowerCase();

    if (isClosing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs = match[2] ?? '';
    const selfClosing = Boolean(match[3]) || VOID_TAGS.has(tag);
    const node: Node = { tag, attrs, children: [] };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }
    if (!selfClosing) {
      stack.push(node);
    }
  }

  return roots;
}

function find(nodes: Node[], predicate: (n: Node) => boolean): Node | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = find(node.children, predicate);
    if (found) return found;
  }
  return undefined;
}

/** Depth-first "does this subtree contain an element matching predicate" check, root included. */
function subtreeContains(node: Node, predicate: (n: Node) => boolean): boolean {
  if (predicate(node)) return true;
  return node.children.some((child) => subtreeContains(child, predicate));
}

describe('Header', () => {
  it("keeps the language pill and Registrieren out of #header > div's last child", async () => {
    const html = await render(Header, { data, currentLocale: 'de' as Locale });
    const roots = parseHtml(html);

    const header = find(roots, (n) => n.tag === 'header' && /id="header"/.test(n.attrs));
    expect(header).toBeDefined();

    // "#header > div" — the single content-row wrapper.
    const contentRow = header!.children.find((n) => n.tag === 'div');
    expect(contentRow).toBeDefined();
    expect(contentRow!.children.length).toBeGreaterThan(0);

    // What BasicScripts.astro's legacy mobile-toggle handler actually queries:
    // document.querySelector('#header > div > div:last-child')
    const lastChild = contentRow!.children[contentRow!.children.length - 1];

    const isLangPill = (n: Node) => n.tag === 'a' && /data-lang="/.test(n.attrs);
    const isRegisterLink = (n: Node) => n.tag === 'a' && /href="https:\/\/m\.flightbook\.ch\/register"/.test(n.attrs);

    if (lastChild.tag === 'div') {
      // If the legacy selector *would* match something, that something must not be — or contain —
      // the language pill or the Registrieren CTA, or they'd blink hidden on every hamburger click.
      expect(subtreeContains(lastChild, isLangPill)).toBe(false);
      expect(subtreeContains(lastChild, isRegisterLink)).toBe(false);
    }
    // If lastChild isn't a <div>, `div:last-child` matches nothing at all — also a pass, since the
    // legacy toggle then becomes a harmless no-op for this row.

    // Independent of the above: the pill and Registrieren must exist somewhere in the row at all.
    expect(subtreeContains(contentRow!, isLangPill)).toBe(true);
    expect(subtreeContains(contentRow!, isRegisterLink)).toBe(true);
  });

  it('keeps the login dropdown menu a direct sibling of its trigger inside .dropdown, for :focus-within', async () => {
    const html = await render(Header, { data, currentLocale: 'de' as Locale });
    const roots = parseHtml(html);

    const dropdown = find(roots, (n) => n.tag === 'div' && /class="[^"]*\bdropdown\b/.test(n.attrs));
    expect(dropdown).toBeDefined();

    // The CSS rule is `.dropdown:focus-within .dropdown-menu`, a descendant combinator — but the
    // wrapper restructure must not have inserted an *extra* div between the .dropdown root and its
    // button/menu children, since that would still satisfy the CSS selector but could change which
    // element the legacy toggle script's positional selectors land on elsewhere in the header.
    const tags = dropdown!.children.map((n) => n.tag);
    expect(tags).toEqual(['button', 'ul']);

    const menu = dropdown!.children.find((n) => n.tag === 'ul');
    expect(menu?.attrs).toMatch(/\bdropdown-menu\b/);
  });

  // N2(b) REGRESSION: the nav was `hidden items-center gap-5 md:flex` — no unprefixed `flex`,
  // so when BasicScripts.astro's toggle removes `.hidden` the browser falls back to the nav's
  // *default* display (`block`), rendering five inline, unspaced links with no tap targets.
  // This is deliberately a class-string assertion, not the usual "assert content/structure, not
  // Tailwind classes" — for a purely visual failure like this one, the class IS the contract, so
  // a future reader should not "fix" this test by loosening it back to a content check.
  it('gives the nav a base flex layout (not only a md:-prefixed one) so the mobile panel is not display:block', async () => {
    const html = await render(Header, { data, currentLocale: 'de' as Locale });
    const navTag = html.match(/<nav\b[^>]*>/)?.[0];
    expect(navTag).toBeDefined();

    const classAttr = navTag!.match(/class="([^"]*)"/)?.[1] ?? '';
    const classes = classAttr.split(/\s+/);

    // An unprefixed (mobile-first) display/flow class must be present — not just `md:flex`.
    expect(classes).toContain('flex-col');
    // And it must not be display:none once `.hidden` is toggled off — i.e. `hidden` alone must
    // not be the only display-affecting base class; `flex-col` only takes effect once `hidden`
    // is removed, which is exactly the toggle script's job.
    expect(classes).toContain('hidden');
    expect(classes).toContain('md:flex');
  });

  it('gives each nav link mobile-sized tap targets while leaving the md: desktop styling untouched', async () => {
    const html = await render(Header, { data, currentLocale: 'de' as Locale });
    const roots = parseHtml(html);
    const nav = find(roots, (n) => n.tag === 'nav');
    expect(nav).toBeDefined();

    const links = nav!.children.filter((n) => n.tag === 'a');
    expect(links.length).toBe(data.links.length);
    for (const link of links) {
      // Adequate mobile tap target (44px guideline): vertical padding plus a readable size.
      expect(link.attrs).toMatch(/\bpy-3\b/);
      expect(link.attrs).toMatch(/\btext-xl\b/);
      // The existing desktop row must be untouched.
      expect(link.attrs).toMatch(/\bmd:text-\[14\.5px\]/);
    }
  });

  // N3 REGRESSION: the logo linked to `#top`, which only exists on the three homepages - on
  // /help, /privacy-policy and their locale variants (6 of 11 routes) it was a dead link.
  it("links the logo to the current locale's home, not the frozen #top anchor", async () => {
    const de = await render(Header, { data, currentLocale: 'de' as Locale });
    const fr = await render(Header, { data, currentLocale: 'fr' as Locale });
    const en = await render(Header, { data, currentLocale: 'en' as Locale });

    expect(de).toContain('href="/" class="flex items-center gap-[11px] text-white"');
    expect(fr).toContain('href="/fr" class="flex items-center gap-[11px] text-white"');
    expect(en).toContain('href="/en" class="flex items-center gap-[11px] text-white"');
  });

  // Source-level, like the ToggleMenu colour test: this failure is purely a
  // pointer-interaction one, invisible to render assertions. The menu is offset
  // below its trigger, and that gap belongs to neither element — so a pointer
  // crossing it drops .dropdown:hover and the menu closes before it can be
  // clicked. The ::before bridge must stay as tall as the offset.
  it('bridges the gap between the login trigger and its menu so hover survives the crossing', async () => {
    const css = readFileSync(new URL('../../assets/styles/tailwind.css', import.meta.url), 'utf8');
    const header = readFileSync(new URL('./Header.astro', import.meta.url), 'utf8');

    const offset = header.match(/top-\[calc\(100%\+(\d+)px\)\]/);
    expect(offset, 'login menu should still be offset below its trigger').not.toBeNull();

    const bridge = css.match(/\.dropdown-menu::before\s*\{([^}]*)\}/);
    expect(bridge, '.dropdown-menu::before bridge is missing — hover will break').not.toBeNull();

    const gap = Number(offset![1]);
    expect(bridge![1]).toContain(`top: -${gap}px`);
    expect(bridge![1]).toContain(`height: ${gap}px`);
  });
});
