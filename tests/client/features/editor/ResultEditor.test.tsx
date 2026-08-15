import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { ResultEditor } from '../../../../src/client/features/editor/ResultEditor';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 4,
  filename: 'reuniao.mp3',
  text: 'uma duas',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('ResultEditor', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the word count for the initial text', () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <ResultEditor record={RECORD} tags={[]} onSaved={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );
    expect(screen.getByText('2 palavras')).toBeInTheDocument();
  });

  it('copies the text to the clipboard on Copiar click', async () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <ResultEditor record={RECORD} tags={[]} onSaved={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('uma duas');
  });
});
