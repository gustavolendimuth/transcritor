import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { planProcessing, UnsupportedAudioError, type AudioInfo } from './audio.js';
import { TranscriptionApiError, type TranscribeChunkFn } from './openaiClient.js';
import type { TranscriptionRepo, TranscriptionRecord } from './db.js';

export interface TranscribeUploadDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
  getAudioInfo: (filePath: string) => Promise<AudioInfo>;
  compressAndSplit: (inputPath: string, outputDir: string) => Promise<string[]>;
}

export async function transcribeUpload(
  deps: TranscribeUploadDeps,
  uploadedFilePath: string,
  originalFilename: string
): Promise<TranscriptionRecord> {
  const info = await deps.getAudioInfo(uploadedFilePath);
  const plan = planProcessing(info);

  let chunkPaths: string[];
  let workDir: string | undefined;

  try {
    if (plan.needsProcessing) {
      workDir = path.join(os.tmpdir(), `transcritor-${randomUUID()}`);
      chunkPaths = await deps.compressAndSplit(uploadedFilePath, workDir);
    } else {
      chunkPaths = [uploadedFilePath];
    }

    if (chunkPaths.length === 0) {
      throw new UnsupportedAudioError('Não foi possível extrair áudio do arquivo enviado');
    }

    const texts: string[] = [];
    for (let i = 0; i < chunkPaths.length; i++) {
      try {
        const result = await deps.transcribeChunk(chunkPaths[i], { withTimestamps: false, language: 'pt' });
        texts.push(result.text);
      } catch (error) {
        throw new TranscriptionApiError(
          `Falha ao transcrever o segmento ${i + 1} de ${chunkPaths.length}`,
          error
        );
      }
    }
    const fullText = texts.join(' ').trim();
    return deps.repo.insert({
      filename: originalFilename,
      text: fullText,
      durationSeconds: info.durationSeconds,
    });
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
}
