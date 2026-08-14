import { Router, json } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { TranscriptionRepo } from './db.js';
import { UnsupportedMediaError, getMediaInfo, extractAudioAndSplit } from './audio.js';
import { TranscriptionApiError, type TranscribeChunkFn } from './openaiClient.js';
import { transcribeUpload, type TranscribeUploadOptions } from './transcribeService.js';
import { isLanguage, type Language } from '../shared/languages.js';

export function parseTranscribeOptions(body: Record<string, unknown>): TranscribeUploadOptions {
  const language: Language =
    typeof body.language === 'string' && isLanguage(body.language) ? body.language : 'pt';
  return {
    withTimestamps: body.withTimestamps === 'true',
    language,
    projectTag: parseProjectTag(body.projectTag),
  };
}

function parseProjectTag(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface RouterDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();
  router.use(json({ limit: '2mb' }));
  const upload = multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      },
    }),
  });

  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de mídia enviado' });
      return;
    }
    const options = parseTranscribeOptions(req.body);
    try {
      const record = await transcribeUpload(
        {
          repo: deps.repo,
          transcribeChunk: deps.transcribeChunk,
          getMediaInfo,
          extractAudioAndSplit,
        },
        req.file.path,
        req.file.originalname,
        options
      );
      res.status(200).json(record);
    } catch (error) {
      if (error instanceof UnsupportedMediaError) {
        res.status(400).json({ error: 'Formato de mídia não suportado' });
      } else if (error instanceof TranscriptionApiError) {
        res.status(502).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erro interno ao transcrever o áudio' });
      }
    } finally {
      await fs.rm(req.file.path, { force: true });
    }
  });

  router.get('/history', (req, res) => {
    const projectTag = typeof req.query.projectTag === 'string' && req.query.projectTag.trim()
      ? req.query.projectTag.trim()
      : undefined;
    res.status(200).json(deps.repo.list(projectTag));
  });

  router.get('/history/tags', (_req, res) => {
    res.status(200).json(deps.repo.listTags());
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

  router.patch('/history/:id', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const changes: { filename?: string; text?: string; projectTag?: string | null } = {};

    if ('filename' in body) {
      if (typeof body.filename !== 'string' || !body.filename.trim()) {
        res.status(400).json({ error: 'Nome inválido' });
        return;
      }
      changes.filename = body.filename.trim();
    }
    if ('text' in body) {
      if (typeof body.text !== 'string') {
        res.status(400).json({ error: 'Texto inválido' });
        return;
      }
      changes.text = body.text;
    }
    if ('projectTag' in body) {
      if (body.projectTag !== null && typeof body.projectTag !== 'string') {
        res.status(400).json({ error: 'Projeto inválido' });
        return;
      }
      changes.projectTag = parseProjectTag(body.projectTag);
    }
    if (Object.keys(changes).length === 0) {
      res.status(400).json({ error: 'Nenhuma alteração enviada' });
      return;
    }

    const record = deps.repo.update(Number(req.params.id), changes);
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
    if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Texto maior que 2MB' });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: 'Upload inválido' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  });

  return router;
}
