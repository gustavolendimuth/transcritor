import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import {
  extractAudioAndSplit,
  getMediaInfo,
  UnsupportedMediaError,
} from '../../src/server/audio.js';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

const mockedExecFile = vi.mocked(execFile);

function resolveExec(stdout = ''): void {
  mockedExecFile.mockImplementation((...args) => {
    const callback = args.at(-1) as (error: Error | null, result: { stdout: string; stderr: string }) => void;
    callback(null, { stdout, stderr: '' });
    return undefined as never;
  });
}

describe('media tools', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcritor-audio-test-'));
    mockedExecFile.mockReset();
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it('reads the uploaded media duration with FFprobe', async () => {
    resolveExec('{"format":{"duration":"42.5"}}');

    await expect(getMediaInfo('/tmp/reuniao.mp4')).resolves.toEqual({ durationSeconds: 42.5 });

    expect(mockedExecFile).toHaveBeenCalledWith(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', '/tmp/reuniao.mp4'],
      expect.any(Function)
    );
  });

  it('reports an unsupported media file without exposing its path when FFprobe cannot read it', async () => {
    mockedExecFile.mockImplementation((...args) => {
      const callback = args.at(-1) as (error: Error) => void;
      callback(new Error('Invalid data found when processing input'));
      return undefined as never;
    });

    await expect(getMediaInfo('/tmp/corrompido.mp4')).rejects.toMatchObject({
      name: UnsupportedMediaError.name,
      message: 'Não foi possível ler o arquivo de mídia',
    });
  });

  it('extracts the first audio stream into sorted five-minute Opus chunks', async () => {
    await fs.writeFile(path.join(outputDir, 'chunk_001.ogg'), 'segundo');
    await fs.writeFile(path.join(outputDir, 'chunk_000.ogg'), 'primeiro');
    resolveExec();

    await expect(extractAudioAndSplit('/tmp/aula.mp4', outputDir)).resolves.toEqual([
      path.join(outputDir, 'chunk_000.ogg'),
      path.join(outputDir, 'chunk_001.ogg'),
    ]);

    expect(mockedExecFile).toHaveBeenCalledWith(
      'ffmpeg',
      [
        '-y',
        '-i',
        '/tmp/aula.mp4',
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
        '300',
        path.join(outputDir, 'chunk_%03d.ogg'),
      ],
      expect.any(Function)
    );
  });

  it('reports an unsupported media file without exposing its path when FFmpeg cannot extract audio', async () => {
    mockedExecFile.mockImplementation((...args) => {
      const callback = args.at(-1) as (error: Error) => void;
      callback(new Error('Stream map 0:a:0 matches no streams'));
      return undefined as never;
    });

    await expect(extractAudioAndSplit('/tmp/sem-audio.mp4', outputDir)).rejects.toMatchObject({
      name: UnsupportedMediaError.name,
      message: 'Falha ao extrair áudio da mídia',
    });
  });
});
