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
    const record = repo.insert({
      filename: 'audio.ogg',
      text: 'ola mundo',
      durationSeconds: 12.5,
      withTimestamps: false,
    });
    expect(record.id).toBeTypeOf('number');
    expect(record.filename).toBe('audio.ogg');
    expect(record.text).toBe('ola mundo');
    expect(record.durationSeconds).toBe(12.5);
    expect(record.withTimestamps).toBe(false);
    expect(record.createdAt).toBeTypeOf('string');
  });

  it('persists withTimestamps=true', () => {
    const record = repo.insert({
      filename: 'audio.ogg',
      text: 'ola mundo',
      durationSeconds: 12.5,
      withTimestamps: true,
    });
    expect(record.withTimestamps).toBe(true);
  });

  it('persists an optional project tag', () => {
    const record = repo.insert({
      filename: 'reuniao.ogg',
      text: 'decisões da reunião',
      durationSeconds: 12.5,
      withTimestamps: false,
      projectTag: 'Cliente Acme',
    });

    expect(record.projectTag).toBe('Cliente Acme');
  });

  it('lists transcriptions most recent first', () => {
    repo.insert({ filename: 'first.ogg', text: 'primeiro', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'second.ogg', text: 'segundo', durationSeconds: 2, withTimestamps: false });
    const list = repo.list();
    expect(list).toHaveLength(2);
    expect(list[0].filename).toBe('second.ogg');
    expect(list[1].filename).toBe('first.ogg');
  });

  it('filters transcriptions by project tag', () => {
    repo.insert({
      filename: 'acme.ogg',
      text: 'acme',
      projectTag: 'Acme',
      durationSeconds: 1,
      withTimestamps: false,
    });
    repo.insert({
      filename: 'interno.ogg',
      text: 'interno',
      projectTag: 'Interno',
      durationSeconds: 2,
      withTimestamps: false,
    });

    expect(repo.list('Acme')).toMatchObject([{ filename: 'acme.ogg', projectTag: 'Acme' }]);
  });

  it('lists distinct project tags alphabetically', () => {
    repo.insert({ filename: 'a.ogg', text: 'a', projectTag: 'Zeta', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'b.ogg', text: 'b', projectTag: 'Acme', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'c.ogg', text: 'c', projectTag: 'Acme', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'd.ogg', text: 'd', durationSeconds: 1, withTimestamps: false });

    expect(repo.listTags()).toEqual(['Acme', 'Zeta']);
  });

  it('updates text and removes a project tag', () => {
    const inserted = repo.insert({
      filename: 'audio.ogg',
      text: 'rascunho',
      projectTag: 'Acme',
      durationSeconds: 1,
      withTimestamps: false,
    });

    expect(repo.update(inserted.id, { text: 'texto revisado', projectTag: null })).toMatchObject({
      text: 'texto revisado',
      projectTag: null,
    });
  });

  it('persists an updated filename', () => {
    const inserted = repo.insert({
      filename: 'audio.ogg',
      text: 'rascunho',
      durationSeconds: 1,
      withTimestamps: false,
    });

    expect(repo.update(inserted.id, { filename: 'reunião-cliente.ogg' })).toMatchObject({
      filename: 'reunião-cliente.ogg',
    });
    expect(repo.get(inserted.id)).toMatchObject({ filename: 'reunião-cliente.ogg' });
  });

  it('gets a transcription by id', () => {
    const inserted = repo.insert({
      filename: 'audio.ogg',
      text: 'texto',
      durationSeconds: 3,
      withTimestamps: false,
    });
    const found = repo.get(inserted.id);
    expect(found).toEqual(inserted);
  });

  it('returns undefined for a missing id', () => {
    expect(repo.get(999)).toBeUndefined();
  });

  it('removes a transcription by id', () => {
    const inserted = repo.insert({
      filename: 'audio.ogg',
      text: 'texto',
      durationSeconds: 3,
      withTimestamps: false,
    });
    expect(repo.remove(inserted.id)).toBe(true);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('returns false when removing a missing id', () => {
    expect(repo.remove(999)).toBe(false);
  });
});
