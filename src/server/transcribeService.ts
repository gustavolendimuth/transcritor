import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { planProcessing, type AudioInfo } from './audio.js';
import type { TranscribeChunkFn } from './openaiClient.js';
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

  if (plan.needsProcessing) {
    workDir = path.join(os.tmpdir(), `transcritor-${randomUUID()}`);
    chunkPaths = await deps.compressAndSplit(uploadedFilePath, workDir);
  } else {
    chunkPaths = [uploadedFilePath];
  }

  try {
    const texts: string[] = [];
    for (const chunkPath of chunkPaths) {
      texts.push(await deps.transcribeChunk(chunkPath));
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
