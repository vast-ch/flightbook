import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import FlightbookSchoolsFeatures from '~/components/widgets/FlightbookSchoolsFeatures.astro';
import { FIGURE_SHELL_CLASSES } from '~/components/ui/ImageCarousel.astro';

const componentPath = fileURLToPath(new URL('./FlightbookSchoolsFeatures.astro', import.meta.url));
const source = fs.readFileSync(componentPath, 'utf-8');

const stub = { src: '/x.png', width: 1, height: 1, format: 'png' as const };
const makeSlides = (count: number, label: string) =>
  Array.from({ length: count }, (_, i) => ({ src: stub, alt: `${label} ${i + 1}` }));

const items = [
  { title: 'Transparenter Lernfortschritt', description: 'Description one.' },
  { title: 'Einfache Teilnahmeverwaltung', description: 'Description two.' },
  { title: 'Fortschritt tracken für Flugschüler', description: 'Description three.' },
];

const props = {
  eyebrow: 'Für Flugschulen',
  title: 'Flightbook Schools',
  cta: 'Flugschule erstellen',
  items,
  studentImg: stub,
  schoolSlides: makeSlides(3, 'School slide'),
  studentSlides: makeSlides(4, 'Student slide'),
};

describe('FlightbookSchoolsFeatures', () => {
  it('renders the section with the frozen id', async () => {
    const html = await render(FlightbookSchoolsFeatures, props);
    expect(html).toContain('id="schools"');
  });

  it('renders the three item headings and descriptions as h3 elements', async () => {
    const html = await render(FlightbookSchoolsFeatures, props);
    for (const item of items) {
      expect(html).toContain(item.title);
      expect(html).toContain(item.description);
    }
    expect(count(html, /<h3\b/g)).toBe(3);
  });

  it('renders exactly two carousel roots receiving different slide counts (3 and 4)', async () => {
    const html = await render(FlightbookSchoolsFeatures, props);

    // Structural half of the independence guarantee: two distinct ImageCarousel
    // instances, not one carousel rendered twice with the same data.
    expect(count(html, /data-carousel\b/g)).toBe(2);
    expect(count(html, /data-slide\b/g)).toBe(3 + 4);

    for (const slide of props.schoolSlides) {
      expect(html).toContain(slide.alt);
    }
    for (const slide of props.studentSlides) {
      expect(html).toContain(slide.alt);
    }
  });

  // RULING R19: both carousels use ImageCarousel's `frame="figure"` variant so the carousel
  // slides get the same bordered white shell as row 1's static image (the design wraps the
  // carousel image, not the nav controls, in that shell). Both get the shell, neither gets
  // the unrelated phone bezel.
  it('wraps both carousels in the figure shell, not the phone bezel', async () => {
    const html = await render(FlightbookSchoolsFeatures, props);
    expect(count(html, /data-figure-frame/g)).toBe(2);
    expect(html).not.toContain('data-phone-frame');
  });

  // Row 1's static image is not routed through ImageCarousel at all, so nothing enforces
  // that its wrapper matches the carousels' shell except sharing the same constant. Import
  // that constant here (rather than pinning its class string) so this test fails if the two
  // are ever built from different literals, without becoming a Tailwind-class-string pin.
  it("reuses ImageCarousel's exported shell classes for row 1's static figure, so all three shells can't drift apart", () => {
    expect(source).toContain('FIGURE_SHELL_CLASSES');
    expect(FIGURE_SHELL_CLASSES.length).toBeGreaterThan(0);
  });

  it('links the CTA to the school registration page', async () => {
    const html = await render(FlightbookSchoolsFeatures, props);
    expect(html).toContain('href="https://instructor.flightbook.ch/school/register"');
    expect(html).toContain(props.cta);
  });

  // RULING R3: "the file contains no <style> or <script> block" is a SOURCE fact, not
  // something a render() assertion can see — Astro bundles client <script> bodies to an
  // external module, so the Container API's renderToString output never contains the
  // original <style>/<script> text either way. A render-based assertion would pass
  // vacuously regardless of whether the ~200 lines of duplicated slider JS still exist in
  // the .astro source, proving nothing. We read the component source directly instead, the
  // same pattern established for ImageCarousel.test.ts.
  it('contains no <style> or <script> block, and no leftover slider classes (source check)', () => {
    expect(source).not.toMatch(/<style\b/);
    expect(source).not.toMatch(/<script\b/);
    expect(source).not.toContain('class="schools-slide"');
    expect(source).not.toContain('class="student-slide"');
    expect(source).not.toContain('schools-slide');
    expect(source).not.toContain('student-slide');
  });
});
