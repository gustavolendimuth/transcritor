import { describe, expect, it } from 'vitest';
import { tagColorVar } from '../../../src/client/lib/tagColor';

describe('lib/tagColor', () => {
  it('returns a CSS var reference in the --tag-color-0..7 range', () => {
    const result = tagColorVar('Cliente Acme');
    expect(result).toMatch(/^var\(--tag-color-[0-7]\)$/);
  });

  it('is deterministic for the same tag', () => {
    expect(tagColorVar('Cliente Acme')).toBe(tagColorVar('Cliente Acme'));
  });

  it('does not export applyTagColor (DOM-coupled, replaced by React style props)', async () => {
    const module = await import('../../../src/client/lib/tagColor');
    expect('applyTagColor' in module).toBe(false);
  });
});
