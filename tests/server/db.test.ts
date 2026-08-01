import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTranscriptionRepo, type TranscriptionRepo } from '../../src/server/db.js';

describe('createTranscriptionRepo', () => {
  let repo: TranscriptionRepo;

  beforeEach(() => {
    repo = createTranscriptionRepo(':memory:');
  });

  afterEach(() => {
    repo.close();
  });

  it('inserts a transcription and returns it with id and createdAt', () => {
    const record = repo.insert({ filename: 'audio.ogg', text: 'ola mundo', durationSeconds: 12.5 });
    expect(record.id).toBeTypeOf('number');
    expect(record.filename).toBe('audio.ogg');
    expect(record.text).toBe('ola mundo');
    expect(record.durationSeconds).toBe(12.5);
    expect(record.createdAt).toBeTypeOf('string');
  });

  it('lists transcriptions most recent first', () => {
    repo.insert({ filename: 'first.ogg', text: 'primeiro', durationSeconds: 1 });
    repo.insert({ filename: 'second.ogg', text: 'segundo', durationSeconds: 2 });
    const list = repo.list();
    expect(list).toHaveLength(2);
    expect(list[0].filename).toBe('second.ogg');
    expect(list[1].filename).toBe('first.ogg');
  });

  it('gets a transcription by id', () => {
    const inserted = repo.insert({ filename: 'audio.ogg', text: 'texto', durationSeconds: 3 });
    const found = repo.get(inserted.id);
    expect(found).toEqual(inserted);
  });

  it('returns undefined for a missing id', () => {
    expect(repo.get(999)).toBeUndefined();
  });

  it('removes a transcription by id', () => {
    const inserted = repo.insert({ filename: 'audio.ogg', text: 'texto', durationSeconds: 3 });
    expect(repo.remove(inserted.id)).toBe(true);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('returns false when removing a missing id', () => {
    expect(repo.remove(999)).toBe(false);
  });
});
