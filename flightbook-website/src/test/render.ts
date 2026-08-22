import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

/** Renders an .astro component to an HTML string for assertion. */
export async function render(
  Component: AstroComponentFactory,
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {}
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Component, { props, slots });
}

/** Counts non-overlapping matches — handy for "how many slides did it emit". */
export function count(html: string, pattern: RegExp): number {
  return (html.match(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')) ?? [])
    .length;
}
