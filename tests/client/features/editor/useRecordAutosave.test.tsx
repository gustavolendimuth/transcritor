import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { useRecordAutosave } from '../../../../src/client/features/editor/useRecordAutosave';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 3,
  filename: 'nota.mp3',
  text: 'texto original',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

let updateFieldRef: {
  text: (text: string) => void;
  filename: (name: string) => void;
} | undefined;

function Probe({ onSaved }: { onSaved: () => void }) {
  const { draft, status, updateField } = useRecordAutosave(RECORD, onSaved);
  updateFieldRef = {
    text: (text) => updateField('text', text),
    filename: (name) => updateField('filename', name),
  };
  return (
    <p>
      {draft.text}:{status}
    </p>
  );
}

describe('useRecordAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('schedules a PATCH 700ms after updateField and reports saved status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onSaved = vi.fn();
    render(
      <AuthProvider>
        <AlertProvider>
          <Probe onSaved={onSaved} />
        </AlertProvider>
      </AuthProvider>
    );

    act(() => {
      updateFieldRef?.text('texto novo');
    });
    expect(screen.getByText('texto novo:saved')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/history/3');
    expect(init?.method).toBe('PATCH');
  });

  it('shows alert with current filename when save fails after rename', async () => {
    const mockFetch = vi.mocked(fetch);

    // First request: rename succeeds
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(RECORD), { status: 200 }));
    // Second request: text update fails
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Network error' }), { status: 500 }));

    const onSaved = vi.fn();
    render(
      <AuthProvider>
        <AlertProvider>
          <Probe onSaved={onSaved} />
        </AlertProvider>
      </AuthProvider>
    );

    // Update filename from 'nota.mp3' to 'reuniao-final.mp3'
    act(() => {
      updateFieldRef?.filename('reuniao-final.mp3');
    });

    // Wait for successful rename save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    // Clear previous calls
    mockFetch.mockClear();

    // Now trigger a text update that will fail
    act(() => {
      updateFieldRef?.text('texto novo que vai falhar');
    });

    // Wait for failed save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    // Verify the alert text contains the CURRENT (renamed) filename, not the original
    // This directly proves the fix: the closure now reads draftRef.current.filename (latest)
    // instead of the stale draft.filename from the first render
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('reuniao-final.mp3'))).toBeInTheDocument();
    });

    // Verify the alert does NOT contain the original filename in the error message
    expect(screen.queryByText((content) => content.includes('nota.mp3') && content.includes('Não foi possível'))).not.toBeInTheDocument();
  });
});
