export type AutosaveStatus = 'saving' | 'saved' | 'error';

export function createAutosave<T>(
  delayMs: number,
  save: (value: T) => Promise<void>,
  onStatus: (status: AutosaveStatus) => void
) {
  let pendingValue: T;
  let hasPendingValue = false;
  let failedValue: T;
  let hasFailedValue = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function trigger() {
    timer = undefined;
    if (inFlight || !hasPendingValue) return;

    const value = pendingValue;
    hasPendingValue = false;
    inFlight = true;
    onStatus('saving');

    void save(value)
      .then(() => {
        hasFailedValue = false;
        if (!hasPendingValue) onStatus('saved');
      })
      .catch(() => {
        failedValue = value;
        hasFailedValue = true;
        onStatus('error');
      })
      .finally(() => {
        inFlight = false;
        if (hasPendingValue && !timer) trigger();
      });
  }

  function scheduleTrigger() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(trigger, delayMs);
  }

  return {
    schedule(value: T) {
      pendingValue = value;
      hasPendingValue = true;
      scheduleTrigger();
    },
    retry() {
      if (!hasFailedValue) return;
      pendingValue = failedValue;
      hasPendingValue = true;
      hasFailedValue = false;
      if (timer) clearTimeout(timer);
      trigger();
    },
  };
}
