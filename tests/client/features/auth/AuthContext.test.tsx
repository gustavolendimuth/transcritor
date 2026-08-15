import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../../../src/client/features/auth/AuthContext';

function Probe() {
  const { isAuthenticated, isBootstrapping, bootstrapError, retryBootstrap, logout } = useAuth();
  if (isBootstrapping) return <p>Carregando…</p>;
  return (
    <div>
      <p>{isAuthenticated ? 'Autenticado' : 'Não autenticado'}</p>
      {bootstrapError && <p>{bootstrapError}</p>}
      <button onClick={logout}>Sair</button>
      <button onClick={retryBootstrap}>Retentar</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unauthenticated when there are no stored credentials', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Não autenticado')).toBeInTheDocument());
  });

  it('becomes authenticated on mount when stored credentials are valid', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Autenticado')).toBeInTheDocument());
  });

  it('logs out on the auth:unauthorized event', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Autenticado')).toBeInTheDocument());

    window.dispatchEvent(new CustomEvent('auth:unauthorized'));

    await waitFor(() => expect(screen.getByText('Não autenticado')).toBeInTheDocument());
  });

  it('exposes a bootstrapError when checking stored credentials fails, and clears it on a successful retry', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Não foi possível conectar ao servidor.')).toBeInTheDocument());
    expect(screen.getByText('Não autenticado')).toBeInTheDocument();

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await userEvent.click(screen.getByRole('button', { name: 'Retentar' }));

    await waitFor(() => expect(screen.getByText('Autenticado')).toBeInTheDocument());
    expect(screen.queryByText('Não foi possível conectar ao servidor.')).not.toBeInTheDocument();
  });
});
