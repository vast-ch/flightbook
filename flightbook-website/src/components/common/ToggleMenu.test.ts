import { describe, expect, it } from 'vitest';
import { render, count } from '~/test/render';
import ToggleMenu from './ToggleMenu.astro';

describe('ToggleMenu', () => {
  // N1 REGRESSION: the three bars were `bg-black dark:bg-white`. Dark mode was removed from
  // this redesign (`.dark` is never applied to anything), so every `dark:` variant is inert and
  // the bars rendered pure black on the dark glass header — invisible to every mobile visitor.
  // This is deliberately a class-string assertion, not the usual "assert content/structure, not
  // Tailwind classes" — for a purely visual failure like this one, the class IS the contract, so
  // a future reader should not "fix" this test by loosening it back to a content check.
  it('renders all three hamburger bars in a light colour, with no dead dark: variant', async () => {
    const html = await render(ToggleMenu);

    // Every bar must use a colour that is visible against the dark glass header right now,
    // not one gated behind a `dark:` variant that nothing ever applies.
    expect(count(html, /class="[^"]*\bbg-white\b[^"]*"/g)).toBe(3);
    expect(html).not.toContain('bg-black');
    expect(html).not.toMatch(/dark:bg-/);
  });

  it('keeps the bars decorative (aria-hidden) and the button itself labelled for screen readers', async () => {
    const html = await render(ToggleMenu);

    expect(count(html, /aria-hidden="true"/g)).toBe(3);
    expect(html).toContain('aria-label="Toggle Menu"');
  });
});
