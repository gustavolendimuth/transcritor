import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { HistoryList } from '../../../../src/client/features/history/HistoryList';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 1,
  filename: 'reuniao.mp3',
  text: 'Olá mundo',
  projectTag: null,
  durationSeconds: 125,
  withTimestamps: false,
  createdAt: '2026-08-15T12:00:00.000Z',
};

function renderList(overrides: Partial<React.ComponentProps<typeof HistoryList>> = {}) {
  const onSelectRecord = vi.fn();
  const onRecordDeleted = vi.fn();
  render(
    <AuthProvider>
      <AlertProvider>
        <HistoryList
          activeTag=""
          activeRecordId={null}
          refreshKey={0}
          onSelectRecord={onSelectRecord}
          onRecordDeleted={onRecordDeleted}
          {...overrides}
        />
      </AlertProvider>
    </AuthProvider>
  );
  return { onSelectRecord, onRecordDeleted };
}

describe('HistoryList', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('transcritor:credentials', btoa('test:test'));
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state when there are no records', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    renderList();
    expect(await screen.findByText(/Nenhuma transcrição ainda/)).toBeInTheDocument();
  });

  it('renders records and calls onSelectRecord on click', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([RECORD]), { status: 200 }));
    const { onSelectRecord } = renderList();
    const item = await screen.findByText('reuniao.mp3');
    await userEvent.click(item);
    expect(onSelectRecord).toHaveBeenCalledWith(RECORD);
  });

  it('deletes a record and calls onRecordDeleted', async () => {
    vi.mocked(fetch).mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify([RECORD]), { status: 200 }));
    });
    const { onRecordDeleted } = renderList();
    await screen.findByText('reuniao.mp3');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir reuniao.mp3' }));
    await waitFor(() => expect(onRecordDeleted).toHaveBeenCalledWith(1));
  });

  it('discards a stale response that resolves after a newer request has started', async () => {
    let callCount = 0;
    let resolveEarlier!: (response: Response) => void;
    let resolveLater!: (response: Response) => void;

    vi.mocked(fetch).mockImplementation(() => {
      callCount += 1;
      // Call #1 is AuthContext's bootstrap check — resolve it immediately.
      if (callCount === 1) return Promise.resolve(new Response(null, { status: 200 }));
      // Call #2 is the first loadHistory() (refreshKey=0) — the earlier-started request.
      if (callCount === 2) return new Promise<Response>((resolve) => { resolveEarlier = resolve; });
      // Call #3 is the second loadHistory() (refreshKey=1) — the later-started request.
      return new Promise<Response>((resolve) => { resolveLater = resolve; });
    });

    const { rerender } = render(
      <AuthProvider>
        <AlertProvider>
          <HistoryList activeTag="" activeRecordId={null} refreshKey={0} onSelectRecord={vi.fn()} onRecordDeleted={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );

    // Wait for the earlier-started request to be in flight.
    await screen.findByRole('status', { name: 'Carregando' });

    // Trigger the later-started request before the earlier one resolves.
    rerender(
      <AuthProvider>
        <AlertProvider>
          <HistoryList activeTag="" activeRecordId={null} refreshKey={1} onSelectRecord={vi.fn()} onRecordDeleted={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(callCount).toBe(3));

    // Resolve the LATER-started request FIRST.
    resolveLater(new Response(JSON.stringify([{ ...RECORD, id: 2, filename: 'segunda.mp3' }]), { status: 200 }));
    await screen.findByText('segunda.mp3');

    // Now resolve the EARLIER-started request LAST — it must be discarded, not clobber the list.
    resolveEarlier(new Response(JSON.stringify([RECORD]), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('segunda.mp3')).toBeInTheDocument();
    expect(screen.queryByText('reuniao.mp3')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument();
  });
});
