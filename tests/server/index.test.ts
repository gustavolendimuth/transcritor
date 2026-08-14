import { describe, expect, it } from 'vitest';
import { resolveApiPort } from '../../src/server/port.js';

describe('resolveApiPort', () => {
  it('prefers Railway PORT over local API_PORT', () => {
    expect(resolveApiPort({ PORT: '9999', API_PORT: '3011' })).toBe(9999);
  });

  it('uses API_PORT locally and falls back to 3011', () => {
    expect(resolveApiPort({ API_PORT: '3012' })).toBe(3012);
    expect(resolveApiPort({})).toBe(3011);
  });
});
