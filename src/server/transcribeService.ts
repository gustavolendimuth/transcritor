import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { planProcessing, UnsupportedAudioError, type AudioInfo } from './audio.js';
import {
  TranscriptionApiError,
  type TranscribeChunkFn,
  type TranscribeChunkResult,
} from './openaiClient.js';
import type { TranscriptionRepo, TranscriptionRecord } from './db.js';

export interface TranscribeUploadDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
  getAudioInfo: (filePath: string) => Promise<AudioInfo>;
  compressAndSplit: (inputPath: string, outputDir: string) => Promise<string[]>;
}

export interface TranscribeUploadOptions {
  withTimestamps: boolean;
  language: string;
}

export async function transcribeUpload(
  deps: TranscribeUploadDeps,
  uploadedFilePath: string,
  originalFilename: string,
  options: TranscribeUploadOptions
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
    const timestampedLines: string[] = [];
    let offsetSeconds = 0;

    for (let i = 0; i < chunkPaths.length; i++) {
      let result: TranscribeChunkResult;
      try {
        result = await deps.transcribeChunk(chunkPaths[i], options);
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
          const chunkInfo = await deps.getAudioInfo(chunkPaths[i]);
          offsetSeconds += chunkInfo.durationSeconds;
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
      durationSeconds: info.durationSeconds,
    });
  } finally {
    if (workDir) {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }
}

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
