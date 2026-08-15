import { useState } from 'react';
import { createUploadQueue, type QueueTask } from '../../lib/uploadQueue';
import { useAuth } from '../auth/AuthContext';
import type { TranscriptionRecord } from '../../types';

export interface UploadPayload {
  file: File;
  projectTag: string | null;
  withTimestamps: boolean;
  language: string;
  record?: TranscriptionRecord;
}

export function useUploadQueueFeature(onRecordCreated: (record: TranscriptionRecord) => void) {
  const { authFetch } = useAuth();
  const [tasks, setTasks] = useState<QueueTask<UploadPayload>[]>([]);

  const [queue] = useState(() =>
    createUploadQueue<UploadPayload>(
      3,
      async (payload) => {
        const formData = new FormData();
        formData.append('audio', payload.file);
        formData.append('withTimestamps', String(payload.withTimestamps));
        formData.append('language', payload.language);
        if (payload.projectTag) formData.append('projectTag', payload.projectTag);
        const response = await authFetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Erro ao transcrever');
        payload.record = data as TranscriptionRecord;
        onRecordCreated(payload.record);
      },
      (updated) => {
        setTasks((current) => {
          const index = current.findIndex((task) => task.id === updated.id);
          if (index === -1) return [...current, { ...updated }];
          const next = [...current];
          next[index] = { ...updated };
          return next;
        });
      }
    )
  );

  return {
    tasks,
    enqueue(payloads: UploadPayload[]) {
      queue.enqueue(payloads);
    },
    retry(task: QueueTask<UploadPayload>) {
      queue.retry(task);
    },
  };
}
