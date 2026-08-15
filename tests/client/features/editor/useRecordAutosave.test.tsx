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

let updateFieldRef: ((text: string) => void) | undefined;

function Probe({ onSaved }: { onSaved: () => void }) {
  const { draft, status, updateField } = useRecordAutosave(RECORD, onSaved);
  updateFieldRef = (text) => updateField('text', text);
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
      updateFieldRef?.('texto novo');
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
});
