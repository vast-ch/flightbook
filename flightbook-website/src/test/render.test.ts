import { describe, expect, it } from 'vitest';
import { render } from '~/test/render';
import Announcement from '~/components/widgets/Announcement.astro';

describe('render harness', () => {
  it('renders an .astro component to a string', async () => {
    const html = await render(Announcement);
    expect(typeof html).toBe('string');
  });
});
