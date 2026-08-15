import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attemptLogin, authFetch, clearCredentials, getCredentials } from '../../../src/client/lib/auth';

describe('lib/auth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores base64 credentials on successful login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const ok = await attemptLogin('alice', 'secret');
    expect(ok).toBe(true);
    expect(getCredentials()).toBe(btoa('alice:secret'));
  });

  it('does not store credentials on failed login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const ok = await attemptLogin('alice', 'wrong');
    expect(ok).toBe(false);
    expect(getCredentials()).toBeNull();
  });

  it('authFetch clears credentials and dispatches auth:unauthorized on 401', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    await authFetch('/api/history');

    expect(getCredentials()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('auth:unauthorized', listener);
  });

  it('clearCredentials removes stored value', () => {
    sessionStorage.setItem('transcritor:credentials', 'abc');
    clearCredentials();
    expect(getCredentials()).toBeNull();
  });
});
