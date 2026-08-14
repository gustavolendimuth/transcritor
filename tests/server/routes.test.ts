import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRouter, parseTranscribeOptions } from '../../src/server/routes.js';
import { createTranscriptionRepo, type TranscriptionRepo } from '../../src/server/db.js';
import {
  extractAudioAndSplit,
  getMediaInfo,
  UnsupportedMediaError,
} from '../../src/server/audio.js';

vi.mock('../../src/server/audio.js', () => {
  class UnsupportedMediaError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'UnsupportedMediaError';
    }
  }
  return {
    UnsupportedMediaError,
    getMediaInfo: vi.fn(async () => ({ durationSeconds: 5 })),
    extractAudioAndSplit: vi.fn(async () => ['/tmp/chunk_000.ogg']),
  };
});

describe('routes', () => {
  let repo: TranscriptionRepo;
  let app: express.Express;

  beforeEach(() => {
    vi.mocked(getMediaInfo).mockReset().mockResolvedValue({ durationSeconds: 5 });
    vi.mocked(extractAudioAndSplit).mockReset().mockResolvedValue(['/tmp/chunk_000.ogg']);
    repo = createTranscriptionRepo(':memory:');
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk: vi.fn(async () => ({ text: 'texto' })) }));
  });

  afterEach(() => {
    repo.close();
  });

  it('POST /api/transcribe without media returns the no-media message', async () => {
    const res = await request(app).post('/api/transcribe');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nenhum arquivo de mídia enviado');
  });

  it('POST /api/transcribe returns a 400 media-format message without logging diagnostics for unsupported media', async () => {
    const unsupportedError = new UnsupportedMediaError('ffprobe falhou');
    Object.defineProperty(unsupportedError, 'cause', {
      value: new Error('/tmp/upload-diagnostico-privado.mp4'),
    });
    vi.mocked(getMediaInfo).mockRejectedValueOnce(unsupportedError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const res = await request(app)
        .post('/api/transcribe')
        .attach('audio', Buffer.from('conteudo'), 'video.mp4');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Formato de mídia não suportado' });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
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
    repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'b.ogg', text: 'b', durationSeconds: 2, withTimestamps: false });
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].filename).toBe('b.ogg');
  });

  it('GET /api/history filters by project tag', async () => {
    repo.insert({ filename: 'a.ogg', text: 'a', projectTag: 'Acme', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'b.ogg', text: 'b', projectTag: 'Interno', durationSeconds: 2, withTimestamps: false });

    const res = await request(app).get('/api/history').query({ projectTag: 'Acme' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{ filename: 'a.ogg', projectTag: 'Acme' }]);
  });

  it('GET /api/history/tags returns the saved project tag suggestions', async () => {
    repo.insert({ filename: 'a.ogg', text: 'a', projectTag: 'Acme', durationSeconds: 1, withTimestamps: false });
    repo.insert({ filename: 'b.ogg', text: 'b', projectTag: 'Interno', durationSeconds: 2, withTimestamps: false });

    const res = await request(app).get('/api/history/tags');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Acme', 'Interno']);
  });

  it('GET /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).get('/api/history/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/history/:id returns the record when it exists', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1, withTimestamps: false });
    const res = await request(app).get(`/api/history/${inserted.id}`);
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('a.ogg');
  });

  it('DELETE /api/history/:id removes an existing record', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1, withTimestamps: false });
    const res = await request(app).delete(`/api/history/${inserted.id}`);
    expect(res.status).toBe(204);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('DELETE /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).delete('/api/history/999');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/history/:id updates text and project tag', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });

    const res = await request(app)
      .patch(`/api/history/${inserted.id}`)
      .send({ text: 'texto revisado', projectTag: 'Acme' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ text: 'texto revisado', projectTag: 'Acme' });
  });

  it('PATCH /api/history/:id trims and persists a filename', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });

    const res = await request(app)
      .patch(`/api/history/${inserted.id}`)
      .send({ filename: '  reunião-cliente.ogg  ' });

    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('reunião-cliente.ogg');
    expect(repo.get(inserted.id)).toMatchObject({ filename: 'reunião-cliente.ogg' });
  });

  it('PATCH /api/history/:id rejects a non-string filename', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });

    const res = await request(app).patch(`/api/history/${inserted.id}`).send({ filename: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nome inválido');
  });

  it('PATCH /api/history/:id rejects a blank filename', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });

    const res = await request(app).patch(`/api/history/${inserted.id}`).send({ filename: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nome inválido');
  });

  it('PATCH /api/history/:id accepts a transcription larger than Express default JSON limit', async () => {
    const inserted = repo.insert({ filename: 'longa.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });
    const text = 'a'.repeat(120 * 1024);

    const res = await request(app).patch(`/api/history/${inserted.id}`).send({ text });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe(text);
  });

  it('PATCH /api/history/:id returns JSON 413 when the text exceeds the supported limit', async () => {
    const inserted = repo.insert({ filename: 'grande.ogg', text: 'rascunho', durationSeconds: 1, withTimestamps: false });

    const res = await request(app)
      .patch(`/api/history/${inserted.id}`)
      .send({ text: 'a'.repeat(2 * 1024 * 1024 + 1) });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Texto maior que 2MB');
  });

  it('POST /api/transcribe forwards the parsed withTimestamps/language to transcribeChunk', async () => {
    const transcribeChunk = vi.fn(async () => ({ text: 'ok' }));
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk }));

    const res = await request(app)
      .post('/api/transcribe')
      .field('withTimestamps', 'true')
      .field('language', 'es')
      .attach('audio', Buffer.from('conteudo'), 'audio.ogg');

    expect(res.status).toBe(200);
    expect(transcribeChunk).toHaveBeenCalledWith(expect.any(String), {
      withTimestamps: true,
      language: 'es',
    });
  });

  it('POST /api/transcribe trims and saves the project tag', async () => {
    const res = await request(app)
      .post('/api/transcribe')
      .field('projectTag', '  Cliente Acme  ')
      .attach('audio', Buffer.from('conteudo'), 'audio.ogg');

    expect(res.status).toBe(200);
    expect(res.body.projectTag).toBe('Cliente Acme');
  });

  it('POST /api/transcribe defaults to withTimestamps=false/language=pt when the fields are omitted', async () => {
    const transcribeChunk = vi.fn(async () => ({ text: 'ok' }));
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk }));

    const res = await request(app)
      .post('/api/transcribe')
      .attach('audio', Buffer.from('conteudo'), 'audio.ogg');

    expect(res.status).toBe(200);
    expect(transcribeChunk).toHaveBeenCalledWith(expect.any(String), {
      withTimestamps: false,
      language: 'pt',
    });
  });
});

describe('parseTranscribeOptions', () => {
  it('defaults to withTimestamps=false and language=pt when the body is empty', () => {
    expect(parseTranscribeOptions({})).toEqual({
      withTimestamps: false,
      language: 'pt',
      projectTag: null,
    });
  });

  it('parses withTimestamps=true and a valid language from string fields', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'true', language: 'en' })).toEqual({
      withTimestamps: true,
      language: 'en',
      projectTag: null,
    });
  });

  it('treats any value other than the string "true" as withTimestamps=false', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'yes' })).toEqual({
      withTimestamps: false,
      language: 'pt',
      projectTag: null,
    });
  });

  it('falls back to pt for an unsupported language', () => {
    expect(parseTranscribeOptions({ language: 'fr' })).toEqual({
      withTimestamps: false,
      language: 'pt',
      projectTag: null,
    });
  });

  it('accepts es as a valid language', () => {
    expect(parseTranscribeOptions({ language: 'es' })).toEqual({
      withTimestamps: false,
      language: 'es',
      projectTag: null,
    });
  });

  it('trims a project tag and maps an empty tag to null', () => {
    expect(parseTranscribeOptions({ projectTag: '  Acme  ' })).toMatchObject({ projectTag: 'Acme' });
    expect(parseTranscribeOptions({ projectTag: '   ' })).toMatchObject({ projectTag: null });
  });
});
