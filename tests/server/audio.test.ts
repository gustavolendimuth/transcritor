import { describe, it, expect } from 'vitest';
import { planProcessing } from '../../src/server/audio.js';

describe('planProcessing', () => {
  it('does not process small, short audio', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 120 });
    expect(plan).toEqual({ needsProcessing: false, chunkCount: 1 });
  });

  it('processes audio over the 25MB size limit', () => {
    const plan = planProcessing({ sizeBytes: 30 * 1024 * 1024, durationSeconds: 120 });
    expect(plan.needsProcessing).toBe(true);
  });

  it('processes audio over the 10 minute duration limit', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 700 });
    expect(plan.needsProcessing).toBe(true);
  });

  it('splits into 5-minute chunks, rounding up', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 1141 });
    expect(plan.chunkCount).toBe(4);
  });

  it('never returns zero chunks for a zero-duration edge case', () => {
    const plan = planProcessing({ sizeBytes: 30 * 1024 * 1024, durationSeconds: 0 });
    expect(plan.chunkCount).toBe(1);
  });
});
