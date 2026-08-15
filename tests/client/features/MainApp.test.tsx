import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../src/client/features/alert/AlertContext';
import { MainApp } from '../../../src/client/features/MainApp';
import type { TranscriptionRecord } from '../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 9,
  filename: 'chamada.mp3',
  text: 'conteudo',
  projectTag: null,
  durationSeconds: 12,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('MainApp', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/history/tags')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        if (url.includes('/api/history')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify(RECORD), { status: 200 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('does not auto-open the editor for a record created by an upload', async () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <MainApp />
        </AlertProvider>
      </AuthProvider>
    );

    const input = screen.getByLabelText(/Arraste áudios ou vídeos/i, { selector: 'input' });
    await userEvent.upload(input, new File(['data'], 'chamada.mp3', { type: 'audio/mpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Transcrever' }));

    // The upload queue item finishes and shows the "Abrir" button, but the editor stays closed.
    await screen.findByRole('button', { name: 'Abrir' });
    expect(screen.queryByLabelText('Nome da transcrição')).not.toBeInTheDocument();

    // Clicking "Abrir" is what opens the editor.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await waitFor(() => expect(screen.getByLabelText('Nome da transcrição')).toHaveValue('chamada.mp3'));
  });

  it('resets the active tag filter when the active tag disappears from the tags list', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('test:test'));
    let tagsCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (url.includes('/api/history/tags')) {
          tagsCallCount += 1;
          // First load has 'ClienteA'; after the refresh triggered by deleting the record, it's gone
          // (but the list stays non-empty, since the dead-guard-replacement effect only resets on a
          // non-empty tags list — an empty list is treated as "not yet loaded", matching the old app).
          const tags = tagsCallCount === 1 ? ['ClienteA', 'ClienteB'] : ['ClienteB'];
          return Promise.resolve(new Response(JSON.stringify(tags), { status: 200 }));
        }
        if (url.includes('/api/history')) return Promise.resolve(new Response(JSON.stringify([RECORD]), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify(RECORD), { status: 200 }));
      })
    );

    render(
      <AuthProvider>
        <AlertProvider>
          <MainApp />
        </AlertProvider>
      </AuthProvider>
    );

    // Activate the 'ClienteA' tag filter.
    const tagChip = await screen.findByRole('button', { name: 'ClienteA' });
    await userEvent.click(tagChip);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false'));

    // Deleting the record bumps refreshKey, which refetches tags — the second response no longer
    // contains 'ClienteA'. The effect under test should reset activeTag back to ''.
    await userEvent.click(screen.getByRole('button', { name: `Excluir ${RECORD.filename}` }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true'));
    // The stale tag chip is gone entirely (tags list no longer includes it), confirming the reset
    // wasn't a coincidence of the chip just re-rendering unpressed.
    expect(screen.queryByRole('button', { name: 'ClienteA' })).not.toBeInTheDocument();
  });
});
