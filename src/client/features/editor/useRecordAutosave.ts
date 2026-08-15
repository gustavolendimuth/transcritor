import { useRef, useState } from 'react';
import { createAutosave, type AutosaveStatus } from '../../lib/autosave';
import { useAuth } from '../auth/AuthContext';
import { useAlert } from '../alert/AlertContext';
import type { TranscriptionChanges, TranscriptionRecord } from '../../types';

export function useRecordAutosave(record: TranscriptionRecord, onSaved: () => void) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [draft, setDraft] = useState<TranscriptionChanges>({
    filename: record.filename,
    text: record.text,
    projectTag: record.projectTag,
  });
  const [status, setStatus] = useState<AutosaveStatus>('saved');

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const [autosave] = useState(() => {
    let hasAlertedSaveError = false;
    return createAutosave<TranscriptionChanges>(
      700,
      async (changes) => {
        const response = await authFetch(`/api/history/${record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar');
        onSaved();
      },
      (nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus === 'saved') {
          hasAlertedSaveError = false;
        } else if (nextStatus === 'error' && !hasAlertedSaveError) {
          hasAlertedSaveError = true;
          showAlert(`Não foi possível salvar as alterações de "${draftRef.current.filename}".`, {
            onRetry: () => autosave.retry(),
          });
        }
      }
    );
  });

  function updateField<K extends keyof TranscriptionChanges>(key: K, value: TranscriptionChanges[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      autosave.schedule(next);
      return next;
    });
  }

  return { draft, status, updateField };
}
