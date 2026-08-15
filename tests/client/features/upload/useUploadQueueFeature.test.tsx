import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { useUploadQueueFeature } from '../../../../src/client/features/upload/useUploadQueueFeature';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 7,
  filename: 'audio.mp3',
  text: 'texto',
  projectTag: null,
  durationSeconds: 10,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

let enqueueRef: ((files: File[]) => void) | undefined;

function Probe({ onRecordCreated }: { onRecordCreated: (record: TranscriptionRecord) => void }) {
  const { tasks, enqueue } = useUploadQueueFeature(onRecordCreated);
  enqueueRef = (files) =>
    enqueue(files.map((file) => ({ file, projectTag: null, withTimestamps: false, language: 'pt' })));
  return <p>{tasks.map((task) => `${task.value.file.name}:${task.status}`).join(', ')}</p>;
}

describe('useUploadQueueFeature', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/transcribe and calls onRecordCreated on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onRecordCreated = vi.fn();
    render(
      <AuthProvider>
        <Probe onRecordCreated={onRecordCreated} />
      </AuthProvider>
    );

    act(() => {
      enqueueRef?.([new File(['data'], 'audio.mp3', { type: 'audio/mpeg' })]);
    });

    await waitFor(() => expect(screen.getByText('audio.mp3:success')).toBeInTheDocument());
    expect(onRecordCreated).toHaveBeenCalledWith(RECORD);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
