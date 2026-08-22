import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import FlightbookFAQ from '~/components/widgets/FlightbookFAQ.astro';

const faqs = [
  {
    question: 'Ist Flightbook an SHV-Prüfungen zugelassen?',
    answer: 'Ja, Flightbook ist offiziell an SHV-Prüfungen zugelassen.',
  },
  {
    question: 'Funktioniert Flightbook für Gleitschirm und Delta?',
    answer: 'Ja, Flightbook ist sowohl für Gleitschirm- als auch für Deltapiloten geeignet.',
  },
  {
    question: 'Kann ich meine IGC-Dateien hochladen?',
    answer: 'Ja, du kannst IGC-Dateien direkt von deinem Vario oder GPS-Tracker hochladen.',
  },
  {
    question: 'Gibt es Flightbook für iOS und Android?',
    answer: 'Ja, Flightbook ist als native App für iOS und Android verfügbar.',
  },
  {
    question: 'Was ist Flightbook Schools?',
    answer: 'Flightbook Schools ist eine kostenlose Lösung für Flugschulen.',
  },
  {
    question: 'Wie kann ich als Flugschule anfangen?',
    answer: 'Der Einstieg ist ganz einfach:',
    steps: ['Erstelle deine Flugschule', 'Füge deine Schüler hinzu', 'Lege los!'],
  },
];

const baseProps = {
  title: 'Häufig gestellte Fragen',
  faqs,
  schoolCtaLabel: 'Flugschule erstellen',
};

describe('FlightbookFAQ', () => {
  it('carries the frozen section id', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    expect(html).toContain('id="faq"');
  });

  it('renders six details elements, every one exclusive via name="faq"', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    expect(count(html, /<details\b/g)).toBe(6);
    expect(count(html, /<details[^>]*\bname="faq"/g)).toBe(6);
  });

  it('renders every question and answer', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    for (const faq of faqs) {
      expect(html).toContain(faq.question);
      expect(html).toContain(faq.answer);
    }
  });

  it('renders no <ol> for entries without steps', async () => {
    const withoutSteps = faqs.filter((faq) => !faq.steps);
    const html = await render(FlightbookFAQ, { ...baseProps, faqs: withoutSteps });
    expect(html).not.toContain('<ol');
  });

  it('renders exactly one <ol> containing the three steps plus the school link, for the entry with steps', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    expect(count(html, /<ol\b/g)).toBe(1);

    const stepped = faqs.find((faq) => faq.steps);
    for (const step of stepped!.steps!) {
      expect(html).toContain(step);
    }
    expect(count(html, /<li\b/g)).toBe(3);
    expect(html).toContain('href="https://instructor.flightbook.ch/school/register"');
    expect(html).toContain(baseProps.schoolCtaLabel);
  });

  it('renders the JSON-LD as a parseable FAQPage schema with one entry per question', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(match).not.toBeNull();

    const schema = JSON.parse(match![1]);
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toHaveLength(faqs.length);
  });

  it('renders the three step numerals in order, each hidden from screen readers', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    const olMatch = html.match(/<ol\b[^>]*>(.*?)<\/ol>/s);
    expect(olMatch).not.toBeNull();

    const liBlocks = olMatch![1].match(/<li\b[^>]*>.*?<\/li>/gs) ?? [];
    expect(liBlocks).toHaveLength(3);

    liBlocks.forEach((li, i) => {
      const numeral = li.match(/<span[^>]*aria-hidden="true"[^>]*>\s*(\d+)\s*<\/span>/);
      expect(numeral).not.toBeNull();
      expect(numeral![1]).toBe(String(i + 1));
    });
  });

  it('includes the step strings in the stepped question schema text, with no HTML tags anywhere in the schema', async () => {
    const html = await render(FlightbookFAQ, baseProps);
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    const schema = JSON.parse(match![1]);

    const stepped = faqs.find((faq) => faq.steps)!;
    const steppedEntity = schema.mainEntity.find((entity: { name: string }) => entity.name === stepped.question);
    expect(steppedEntity).toBeDefined();
    for (const step of stepped.steps!) {
      expect(steppedEntity.acceptedAnswer.text).toContain(step);
    }

    expect(match![1]).not.toMatch(/<[^>]+>/);
  });
});
