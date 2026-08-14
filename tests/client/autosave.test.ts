import { describe, expect, it, vi } from 'vitest';
import { createAutosave } from '../../src/client/autosave.js';

describe('createAutosave', () => {
  it('saves the latest value after the configured pause', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave(700, save, vi.fn());

    autosave.schedule('primeira versão');
    autosave.schedule('versão final');
    await vi.advanceTimersByTimeAsync(700);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('versão final');
    vi.useRealTimers();
  });

  it('serializes a new save while the previous request is pending', async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const save = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(undefined);
    const autosave = createAutosave(700, save, vi.fn());

    autosave.schedule('primeira');
    await vi.advanceTimersByTimeAsync(700);
    autosave.schedule('segunda');
    await vi.advanceTimersByTimeAsync(700);
    expect(save).toHaveBeenCalledTimes(1);

    finishFirst();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenNthCalledWith(1, 'primeira');
    expect(save).toHaveBeenNthCalledWith(2, 'segunda');
    vi.useRealTimers();
  });

  it('keeps the debounce delay when an earlier save finishes during a new pause', async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const save = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(undefined);
    const autosave = createAutosave(700, save, vi.fn());

    autosave.schedule('primeira');
    await vi.advanceTimersByTimeAsync(700);
    autosave.schedule('segunda');
    await vi.advanceTimersByTimeAsync(100);
    finishFirst();
    await Promise.resolve();
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(599);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
