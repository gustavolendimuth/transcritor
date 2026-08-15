import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/client/App';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/history/tags')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        if (url.includes('/api/history')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        return Promise.resolve(new Response(null, { status: 200 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the login screen when unauthenticated', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Transcritor' })).toBeInTheDocument());
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
  });

  it('shows the header and main app once logged in', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Usuário')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Usuário'), 'alice');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('shows a connection-failure alert with a working retry when bootstrap cannot reach the server', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

    render(<App />);

    expect(await screen.findByText('Não foi possível conectar ao servidor.')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' });

    // The retry re-runs bootstrap; make it succeed this time.
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await userEvent.click(retryButton);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument());
    expect(screen.queryByText('Não foi possível conectar ao servidor.')).not.toBeInTheDocument();
  });
});
