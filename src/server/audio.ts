import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export class UnsupportedAudioError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'UnsupportedAudioError';
  }
}

export interface AudioInfo {
  durationSeconds: number;
  sizeBytes: number;
}

export interface ProcessingPlan {
  needsProcessing: boolean;
  chunkCount: number;
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // limite da API da OpenAI
const MAX_DURATION_SECONDS = 10 * 60; // faixa onde observamos truncamento da resposta
const CHUNK_DURATION_SECONDS = 5 * 60;

export function planProcessing(info: AudioInfo): ProcessingPlan {
  const needsProcessing =
    info.sizeBytes > MAX_SIZE_BYTES || info.durationSeconds > MAX_DURATION_SECONDS;
  if (!needsProcessing) {
    return { needsProcessing: false, chunkCount: 1 };
  }
  const chunkCount = Math.max(1, Math.ceil(info.durationSeconds / CHUNK_DURATION_SECONDS));
  return { needsProcessing: true, chunkCount };
}

export async function getAudioInfo(filePath: string): Promise<AudioInfo> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration,size',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const durationSeconds = Number(parsed.format?.duration);
    const sizeBytes = Number(parsed.format?.size);
    if (!Number.isFinite(durationSeconds) || !Number.isFinite(sizeBytes)) {
      throw new Error('ffprobe returned invalid duration/size');
    }
    return { durationSeconds, sizeBytes };
  } catch (error) {
    throw new UnsupportedAudioError(`Não foi possível ler o arquivo de áudio: ${filePath}`, error);
  }
}

export async function compressAndSplit(inputPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const pattern = path.join(outputDir, 'chunk_%03d.ogg');
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-ac',
      '1',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-f',
      'segment',
      '-segment_time',
      String(CHUNK_DURATION_SECONDS),
      pattern,
    ]);
  } catch (error) {
    throw new UnsupportedAudioError(`Falha ao processar o áudio: ${inputPath}`, error);
  }
  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.ogg'))
    .sort()
    .map((f) => path.join(outputDir, f));
}
