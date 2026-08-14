export type QueueStatus = 'queued' | 'processing' | 'success' | 'error';

export interface QueueTask<T> {
  id: string;
  value: T;
  status: QueueStatus;
  error?: string;
}

export function createUploadQueue<T>(
  concurrency: number,
  execute: (value: T) => Promise<void>,
  onChange: (task: QueueTask<T>) => void
) {
  const tasks: QueueTask<T>[] = [];
  let activeCount = 0;
  let nextId = 1;

  function drain() {
    while (activeCount < concurrency) {
      const task = tasks.find((item) => item.status === 'queued');
      if (!task) return;

      activeCount += 1;
      task.status = 'processing';
      task.error = undefined;
      onChange(task);

      void execute(task.value)
        .then(() => {
          task.status = 'success';
        })
        .catch((error: unknown) => {
          task.status = 'error';
          task.error = error instanceof Error ? error.message : 'Erro ao transcrever';
        })
        .finally(() => {
          activeCount -= 1;
          onChange(task);
          drain();
        });
    }
  }

  return {
    enqueue(values: T[]): QueueTask<T>[] {
      const newTasks = values.map((value) => ({
        id: `upload-${nextId++}`,
        value,
        status: 'queued' as const,
      }));
      tasks.push(...newTasks);
      for (const task of newTasks) onChange(task);
      drain();
      return newTasks;
    },
    retry(task: QueueTask<T>) {
      if (task.status !== 'error') return;
      task.status = 'queued';
      task.error = undefined;
      onChange(task);
      drain();
    },
  };
}
