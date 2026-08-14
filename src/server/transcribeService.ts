import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { UnsupportedMediaError, type MediaInfo } from './audio.js';
import {
  TranscriptionApiError,
  type TranscribeChunkFn,
  type TranscribeChunkOptions,
  type TranscribeChunkResult,
} from './openaiClient.js';
import type { TranscriptionRepo, TranscriptionRecord } from './db.js';

export interface TranscribeUploadDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
  getMediaInfo: (filePath: string) => Promise<MediaInfo>;
  extractAudioAndSplit: (inputPath: string, outputDir: string) => Promise<string[]>;
}

export interface TranscribeUploadOptions extends TranscribeChunkOptions {
  projectTag?: string | null;
}

export async function transcribeUpload(
  deps: TranscribeUploadDeps,
  uploadedFilePath: string,
  originalFilename: string,
  options: TranscribeUploadOptions
): Promise<TranscriptionRecord> {
  const { projectTag = null, ...transcribeOptions } = options;
  const workDir = path.join(os.tmpdir(), `transcritor-${randomUUID()}`);

  try {
    const chunkPaths = await deps.extractAudioAndSplit(uploadedFilePath, workDir);

    if (chunkPaths.length === 0) {
      throw new UnsupportedMediaError('Não foi possível extrair áudio do arquivo enviado');
    }

    const chunkDurations = await Promise.all(
      chunkPaths.map(async (chunkPath) => {
        const { durationSeconds } = await deps.getMediaInfo(chunkPath);
        if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
          throw new UnsupportedMediaError('Não foi possível determinar a duração do áudio extraído');
        }
        return durationSeconds;
      })
    );
    const durationSeconds = chunkDurations.reduce((total, chunkDuration) => total + chunkDuration, 0);

    const texts: string[] = [];
    const timestampedLines: string[] = [];
    let offsetSeconds = 0;

    for (let i = 0; i < chunkPaths.length; i++) {
      let result: TranscribeChunkResult;
      try {
        result = await deps.transcribeChunk(chunkPaths[i], transcribeOptions);
      } catch (error) {
        throw new TranscriptionApiError(
          `Falha ao transcrever o segmento ${i + 1} de ${chunkPaths.length}`,
          error
        );
      }

      if (options.withTimestamps) {
        if (result.segments && result.segments.length > 0) {
          for (const segment of result.segments) {
            timestampedLines.push(`[${formatTimestamp(offsetSeconds + segment.start)}] ${segment.text}`);
          }
        } else if (result.text.trim()) {
          timestampedLines.push(`[${formatTimestamp(offsetSeconds)}] ${result.text.trim()}`);
        }
        if (i < chunkPaths.length - 1) {
          offsetSeconds += chunkDurations[i];
        }
      } else {
        texts.push(result.text);
      }
    }

    const fullText = options.withTimestamps
      ? timestampedLines.join('\n')
      : texts.join(' ').trim();

    return deps.repo.insert({
      filename: originalFilename,
      text: fullText,
      projectTag,
      durationSeconds,
      withTimestamps: options.withTimestamps,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
