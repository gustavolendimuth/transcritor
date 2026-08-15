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
  });

  it('opens the editor for a record created by an upload', async () => {
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

    await waitFor(() => expect(screen.getByLabelText('Nome da transcrição')).toHaveValue('chamada.mp3'));
  });
});
