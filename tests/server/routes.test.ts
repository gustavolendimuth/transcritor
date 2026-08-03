import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRouter, parseTranscribeOptions } from '../../src/server/routes.js';
import { createTranscriptionRepo, type TranscriptionRepo } from '../../src/server/db.js';

describe('routes', () => {
  let repo: TranscriptionRepo;
  let app: express.Express;

  beforeEach(() => {
    repo = createTranscriptionRepo(':memory:');
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk: vi.fn(async () => ({ text: 'texto' })) }));
  });

  afterEach(() => {
    repo.close();
  });

  it('POST /api/transcribe without a file returns 400', async () => {
    const res = await request(app).post('/api/transcribe');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf('string');
  });

  it('POST /api/transcribe with the wrong field name returns 400 JSON, not an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/transcribe')
      .attach('arquivo_errado', Buffer.from('conteudo'), 'audio.ogg');
    expect(res.status).toBe(400);
    expect(res.type).toBe('application/json');
    expect(res.body.error).toBeTypeOf('string');
  });

  it('GET /api/history returns an empty list initially', async () => {
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/history returns saved transcriptions most recent first', async () => {
    repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    repo.insert({ filename: 'b.ogg', text: 'b', durationSeconds: 2 });
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].filename).toBe('b.ogg');
  });

  it('GET /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).get('/api/history/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/history/:id returns the record when it exists', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    const res = await request(app).get(`/api/history/${inserted.id}`);
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('a.ogg');
  });

  it('DELETE /api/history/:id removes an existing record', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    const res = await request(app).delete(`/api/history/${inserted.id}`);
    expect(res.status).toBe(204);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('DELETE /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).delete('/api/history/999');
    expect(res.status).toBe(404);
  });
});

describe('parseTranscribeOptions', () => {
  it('defaults to withTimestamps=false and language=pt when the body is empty', () => {
    expect(parseTranscribeOptions({})).toEqual({ withTimestamps: false, language: 'pt' });
  });

  it('parses withTimestamps=true and a valid language from string fields', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'true', language: 'en' })).toEqual({
      withTimestamps: true,
      language: 'en',
    });
  });

  it('treats any value other than the string "true" as withTimestamps=false', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'yes' })).toEqual({
      withTimestamps: false,
      language: 'pt',
    });
  });

  it('falls back to pt for an unsupported language', () => {
    expect(parseTranscribeOptions({ language: 'fr' })).toEqual({
      withTimestamps: false,
      language: 'pt',
    });
  });

  it('accepts es as a valid language', () => {
    expect(parseTranscribeOptions({ language: 'es' })).toEqual({
      withTimestamps: false,
      language: 'es',
    });
  });
});
