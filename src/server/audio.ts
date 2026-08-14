import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export class UnsupportedMediaError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'UnsupportedMediaError';
  }
}

export interface MediaInfo {
  durationSeconds: number;
}

const CHUNK_DURATION_SECONDS = 5 * 60;

export async function getMediaInfo(filePath: string): Promise<MediaInfo> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const durationSeconds = Number(parsed.format?.duration);
    if (!Number.isFinite(durationSeconds)) {
      throw new Error('ffprobe returned invalid duration');
    }
    return { durationSeconds };
  } catch (error) {
    throw new UnsupportedMediaError(`Não foi possível ler o arquivo de mídia: ${filePath}`, error);
  }
}

export async function extractAudioAndSplit(inputPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const pattern = path.join(outputDir, 'chunk_%03d.ogg');
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:a:0',
      '-vn',
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
    throw new UnsupportedMediaError(`Falha ao extrair áudio da mídia: ${inputPath}`, error);
  }
  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.ogg'))
    .sort()
    .map((f) => path.join(outputDir, f));
}
