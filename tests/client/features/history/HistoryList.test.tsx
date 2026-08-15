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
});
