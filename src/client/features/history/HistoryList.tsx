import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAlert } from '../alert/AlertContext';
import { Spinner } from '../../ui/Spinner';
import { TagPill } from '../../ui/TagPill';
import type { TranscriptionRecord } from '../../types';

export interface HistoryListProps {
  activeTag: string;
  activeRecordId: number | null;
  refreshKey: number;
  onSelectRecord: (record: TranscriptionRecord) => void;
  onRecordDeleted: (id: number) => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function HistoryList({ activeTag, activeRecordId, refreshKey, onSelectRecord, onRecordDeleted }: HistoryListProps) {
  const { authFetch, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const [records, setRecords] = useState<TranscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const loadVersionRef = useRef(0);

  async function loadHistory() {
    const loadVersion = ++loadVersionRef.current;
    setIsLoading(true);
    try {
      const url = activeTag ? `/api/history?${new URLSearchParams({ projectTag: activeTag })}` : '/api/history';
      const response = await authFetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar o histórico');
      const data = (await response.json()) as TranscriptionRecord[];
      if (loadVersion !== loadVersionRef.current) return;
      setRecords(data);
    } catch (error) {
      if (loadVersion !== loadVersionRef.current) return;
      showAlert(error instanceof Error ? error.message : 'Erro ao carregar histórico', {
        onRetry: () => void loadHistory(),
      });
    } finally {
      if (loadVersion === loadVersionRef.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTag, refreshKey]);

  async function deleteRecord(record: TranscriptionRecord) {
    setDeletingId(record.id);
    try {
      const response = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
      if (!response.ok) {
        showAlert(`Não foi possível excluir "${record.filename}".`, { onRetry: () => void deleteRecord(record) });
        return;
      }
      onRecordDeleted(record.id);
      await loadHistory();
    } catch {
      showAlert(`Não foi possível excluir "${record.filename}".`, { onRetry: () => void deleteRecord(record) });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {isLoading && <Spinner size="sm" className="mb-2" />}
      {!isLoading && records.length === 0 && (
        <p className="text-ctp-subtext0 text-[0.9375rem] m-0">
          Nenhuma transcrição ainda — envie um áudio acima para começar.
        </p>
      )}
      <ul className="list-none p-0 m-0">
        {records.map((record) => (
          <li
            key={record.id}
            className={`flex items-center justify-between gap-2 border-b border-ctp-surface1 last:border-none ${
              record.id === activeRecordId ? 'bg-ctp-surface1/40' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectRecord(record)}
              className="flex-1 flex flex-col items-start gap-0.5 bg-transparent border-none py-2 text-left cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 flex-wrap text-ctp-text text-[0.9375rem]">
                {record.filename}
                {record.projectTag && <TagPill tag={record.projectTag} />}
                {record.withTimestamps && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-ctp-mauve/15 text-ctp-mauve text-[0.6875rem] font-medium">
                    Com tempo
                  </span>
                )}
              </span>
              <span className="text-ctp-subtext0 text-[0.8125rem] font-mono">
                {formatDuration(record.durationSeconds)} · {new Date(record.createdAt).toLocaleString('pt-BR')}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Excluir ${record.filename}`}
              disabled={deletingId === record.id}
              onClick={(event) => {
                event.stopPropagation();
                void deleteRecord(record);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-ctp-overlay0 hover:bg-ctp-red/10 hover:text-ctp-red disabled:opacity-60"
            >
              {deletingId === record.id ? <Spinner size="sm" /> : '✕'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
