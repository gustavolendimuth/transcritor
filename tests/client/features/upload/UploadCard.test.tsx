import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { UploadCard } from '../../../../src/client/features/upload/UploadCard';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 1,
  filename: 'audio.mp3',
  text: '',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('UploadCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables the transcribe button once a file is selected, and uploads on click', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onRecordCreated = vi.fn();
    render(
      <AuthProvider>
        <UploadCard tags={[]} onRecordCreated={onRecordCreated} onOpenRecord={vi.fn()} />
      </AuthProvider>
    );

    const button = screen.getByRole('button', { name: 'Transcrever' });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText(/Arraste áudios ou vídeos/i, { selector: 'input' });
    const file = new File(['data'], 'audio.mp3', { type: 'audio/mpeg' });
    await userEvent.upload(input, file);

    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(onRecordCreated).toHaveBeenCalledWith(RECORD));

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const uploadedFile = body.get('audio');
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe('audio.mp3');
    expect(body.get('withTimestamps')).toBe('false');
    expect(body.get('language')).toBe('pt');
  });
});
