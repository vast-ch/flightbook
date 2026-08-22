import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import FlightbookPricing from '~/components/widgets/FlightbookPricing.astro';

const plans = [
  {
    badge: 'Pilot',
    title: 'Flightbook FREE',
    price: 'FREE',
    features: ['Flüge verwalten (Max 25 Flüge)', 'Passagierbestätigungen (Max 10)', 'Statistiken'],
    cta: 'Registrieren',
    ctaLink: 'https://m.flightbook.ch/register',
    featured: false,
  },
  {
    badge: 'Pilot · Empfohlen',
    title: 'Flightbook Premium',
    price: 'CHF 12.-',
    period: '/ Jahr',
    features: ['Flüge verwalten', 'Passagierbestätigungen', 'Statistiken'],
    cta: 'Jetzt abonnieren',
    ctaLink: 'https://m.flightbook.ch/settings',
    featured: true,
  },
  {
    badge: 'École de vol',
    title: 'Flightbook Schools',
    price: 'FREE',
    features: ['Transparenter Lernfortschritt', 'Einfache Teilnahmeverwaltung'],
    cta: 'Créer une école de vol',
    ctaLink: 'https://instructor.flightbook.ch/school/register',
    featured: false,
  },
];

const notes = [
  'Die ersten 25 Flüge sind Gratis und können kostenlos hinzugefügt werden.',
  'Preisänderung ab dem 1. Februar 2023 für neue Nutzer.',
  'Die gesamte Anwendung bleibt Open Source.',
];

const baseProps = {
  title: 'Pricing',
  intro: 'Die ersten 25 Flüge sind Gratis und können kostenlos hinzugefügt werden.',
  plans,
  notes,
};

describe('FlightbookPricing', () => {
  it('carries the frozen section id', async () => {
    const html = await render(FlightbookPricing, baseProps);
    expect(html).toContain('id="angebot"');
  });

  it('renders three cards, each showing its title, price and every feature', async () => {
    const html = await render(FlightbookPricing, baseProps);
    for (const plan of plans) {
      expect(html).toContain(plan.title);
      expect(html).toContain(plan.price);
      for (const feature of plan.features) {
        expect(html).toContain(feature);
      }
    }
  });

  it('marks exactly one card as featured via a stable data attribute', async () => {
    const html = await render(FlightbookPricing, baseProps);
    expect(count(html, /data-featured\b/g)).toBe(1);
  });

  it('gives each plan a CTA whose href matches its ctaLink, and all three differ', async () => {
    const html = await render(FlightbookPricing, baseProps);
    for (const plan of plans) {
      expect(html).toContain(`href="${plan.ctaLink}"`);
    }
    const links = new Set(plans.map((plan) => plan.ctaLink));
    expect(links.size).toBe(plans.length);
  });

  it('renders the period suffix only for the plan that has one', async () => {
    const html = await render(FlightbookPricing, baseProps);
    expect(count(html, /\/ Jahr/g)).toBe(1);
    const withoutPeriod = plans.filter((plan) => !plan.period);
    expect(withoutPeriod).toHaveLength(2);
  });

  it('renders every note', async () => {
    const html = await render(FlightbookPricing, baseProps);
    for (const note of notes) {
      expect(html).toContain(note);
    }
  });

  it('renders badge text as-is regardless of its value, with no branch on the string', async () => {
    // Regression: the old code branched on `plan.badge === 'Flugschule' || 'Instructeur'`,
    // which silently failed to match a third locale's badge text (e.g. English or this
    // French value). Assert the badge renders identically no matter what string it holds.
    const html = await render(FlightbookPricing, baseProps);
    expect(html).toContain('École de vol');

    const swapped = plans.map((plan) => (plan.badge === 'École de vol' ? { ...plan, badge: 'Flight school' } : plan));
    const swappedHtml = await render(FlightbookPricing, { ...baseProps, plans: swapped });
    expect(swappedHtml).toContain('Flight school');
    expect(swappedHtml).not.toContain('École de vol');

    // Card structure (min-height, gradient background) must be identical either way —
    // only the featured flag governs card styling, never the badge text.
    const stripBadge = (html: string, badge: string) => html.replace(new RegExp(badge, 'g'), '__BADGE__');
    expect(stripBadge(html, 'École de vol')).toBe(stripBadge(swappedHtml, 'Flight school'));
  });
});
