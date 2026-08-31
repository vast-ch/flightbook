import { describe, expect, it } from 'vitest';
import { render } from '~/test/render';
import PhoneFrame from '~/components/ui/PhoneFrame.astro';

describe('PhoneFrame', () => {
  it('renders its slot content', async () => {
    const html = await render(PhoneFrame, {}, { default: '<img alt="screen" />' });
    expect(html).toContain('alt="screen"');
  });

  it('maps each radius token to a distinct bezel', async () => {
    const [lg, md, sm] = await Promise.all(
      (['lg', 'md', 'sm'] as const).map((radius) => render(PhoneFrame, { radius }))
    );
    expect(new Set([lg, md, sm]).size).toBe(3);
  });

  it('animates only when float is set', async () => {
    expect(await render(PhoneFrame, {})).not.toContain('animate-float');
    expect(await render(PhoneFrame, { float: true })).toContain('animate-float');
  });
});
