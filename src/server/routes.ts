import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { TranscriptionRepo } from './db.js';
import { UnsupportedAudioError, getAudioInfo, compressAndSplit } from './audio.js';
import { TranscriptionApiError, type TranscribeChunkFn } from './openaiClient.js';
import { transcribeUpload, type TranscribeUploadOptions } from './transcribeService.js';

const ALLOWED_LANGUAGES = new Set(['pt', 'en', 'es']);

export function parseTranscribeOptions(body: Record<string, unknown>): TranscribeUploadOptions {
  const language =
    typeof body.language === 'string' && ALLOWED_LANGUAGES.has(body.language)
      ? body.language
      : 'pt';
  return {
    withTimestamps: body.withTimestamps === 'true',
    language,
  };
}

export interface RouterDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
      return;
    }
    const options = parseTranscribeOptions(req.body);
    try {
      const record = await transcribeUpload(
        {
          repo: deps.repo,
          transcribeChunk: deps.transcribeChunk,
          getAudioInfo,
          compressAndSplit,
        },
        req.file.path,
        req.file.originalname,
        options
      );
      res.status(200).json(record);
    } catch (error) {
      if (error instanceof UnsupportedAudioError) {
        console.error(error.message, error.cause);
        res.status(400).json({ error: 'Formato de áudio não suportado' });
      } else if (error instanceof TranscriptionApiError) {
        res.status(502).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erro interno ao transcrever o áudio' });
      }
    } finally {
      await fs.rm(req.file.path, { force: true });
    }
  });

  router.get('/history', (_req, res) => {
    res.status(200).json(deps.repo.list());
  });

  router.get('/history/:id', (req, res) => {
    const id = Number(req.params.id);
    const record = deps.repo.get(id);
    if (!record) {
      res.status(404).json({ error: 'Transcrição não encontrada' });
      return;
    }
    res.status(200).json(record);
  });

  router.delete('/history/:id', (req, res) => {
    const id = Number(req.params.id);
    const removed = deps.repo.remove(id);
    res.status(removed ? 204 : 404).end();
  });

  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 100MB' : 'Upload inválido';
      res.status(400).json({ error: message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  });

  return router;
}
