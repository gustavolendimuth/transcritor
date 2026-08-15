import { describe, expect, it, vi } from 'vitest';
import { createUploadQueue } from '../../../src/client/lib/uploadQueue.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('createUploadQueue', () => {
  it('runs no more than the configured number of uploads at once', async () => {
    const uploads = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()];
    const execute = vi.fn((value: number) => uploads[value].promise);
    const onChange = vi.fn();
    const queue = createUploadQueue(3, execute, onChange);

    const tasks = queue.enqueue([0, 1, 2, 3]);

    expect(execute).toHaveBeenCalledTimes(3);
    expect(tasks.map((task) => task.status)).toEqual(['processing', 'processing', 'processing', 'queued']);

    uploads[0].resolve();
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(4));

    expect(tasks[0].status).toBe('success');
    expect(tasks[3].status).toBe('processing');
  });

  it('marks a failed task and allows it to be retried', async () => {
    const execute = vi
      .fn(async (_value: string) => undefined)
      .mockRejectedValueOnce(new Error('limite da API'))
      .mockResolvedValueOnce(undefined);
    const queue = createUploadQueue(1, execute, vi.fn());
    const [task] = queue.enqueue(['reuniao.ogg']);

    await Promise.resolve();
    await Promise.resolve();
    expect(task).toMatchObject({ status: 'error', error: 'limite da API' });

    queue.retry(task);
    await Promise.resolve();
    await Promise.resolve();
    expect(task.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
