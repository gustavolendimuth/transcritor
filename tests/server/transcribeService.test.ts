import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { transcribeUpload, type TranscribeUploadDeps } from '../../src/server/transcribeService.js';
import { createTranscriptionRepo } from '../../src/server/db.js';
import { UnsupportedMediaError } from '../../src/server/audio.js';

const NO_TIMESTAMPS = { withTimestamps: false, language: 'pt' } as const;
const WITH_TIMESTAMPS = { withTimestamps: true, language: 'pt' } as const;

function makeDeps(overrides: Partial<TranscribeUploadDeps> = {}): TranscribeUploadDeps {
  return {
    repo: createTranscriptionRepo(':memory:'),
    transcribeChunk: vi.fn(async () => ({ text: 'texto' })),
    getMediaInfo: vi.fn(async () => ({ durationSeconds: 60 })),
    extractAudioAndSplit: vi.fn(async () => []),
    ...overrides,
  };
}

async function writeChunk(outputDir: string, index: number): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const chunkPath = path.join(outputDir, `chunk_${String(index).padStart(3, '0')}.ogg`);
  await fs.writeFile(chunkPath, 'audio');
  return chunkPath;
}

async function expectDirectoryRemoved(directory: string | undefined): Promise<void> {
  expect(directory).toBeDefined();
  await expect(fs.access(directory!)).rejects.toThrow();
}

describe('transcribeUpload', () => {
  it('transcribes chunks from media without an original duration and derives its duration from them', async () => {
    let workDir: string | undefined;
    const extractAudioAndSplit = vi.fn(async (_input: string, outputDir: string) => {
      workDir = outputDir;
      return [await writeChunk(outputDir, 0)];
    });
    const transcribeChunk = vi.fn(async () => ({ text: 'texto normalizado' }));
    const getMediaInfo = vi.fn(async (filePath: string) => {
      if (filePath === '/tmp/aula-sem-duracao.mp4') {
        throw new UnsupportedMediaError('Não foi possível ler o arquivo de mídia');
      }
      return { durationSeconds: 300 };
    });
    const deps = makeDeps({ extractAudioAndSplit, getMediaInfo, transcribeChunk });

    const record = await transcribeUpload(
      deps,
      '/tmp/aula-sem-duracao.mp4',
      'aula-sem-duracao.mp4',
      NO_TIMESTAMPS
    );

    expect(extractAudioAndSplit).toHaveBeenCalledWith('/tmp/aula-sem-duracao.mp4', expect.any(String));
    expect(getMediaInfo).not.toHaveBeenCalledWith('/tmp/aula-sem-duracao.mp4');
    expect(transcribeChunk).toHaveBeenCalledWith(
      expect.stringMatching(/chunk_000\.ogg$/),
      NO_TIMESTAMPS
    );
    expect(record).toMatchObject({
      filename: 'aula-sem-duracao.mp4',
      text: 'texto normalizado',
      durationSeconds: 300,
    });
    await expectDirectoryRemoved(workDir);
  });

  it('transcribes returned chunks in order and accumulates their timestamp offsets', async () => {
    const chunks = ['/tmp/chunk_000.ogg', '/tmp/chunk_001.ogg'];
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce({ text: 'primeira', segments: [{ start: 2, text: 'Primeira.' }] })
      .mockResolvedValueOnce({ text: 'segunda', segments: [{ start: 1, text: 'Segunda.' }] });
    const getMediaInfo = vi
      .fn()
      .mockResolvedValueOnce({ durationSeconds: 300 })
      .mockResolvedValueOnce({ durationSeconds: 200 });
    const deps = makeDeps({
      getMediaInfo,
      extractAudioAndSplit: vi.fn(async () => chunks),
      transcribeChunk,
    });

    const record = await transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', WITH_TIMESTAMPS);

    expect(transcribeChunk).toHaveBeenNthCalledWith(1, chunks[0], WITH_TIMESTAMPS);
    expect(transcribeChunk).toHaveBeenNthCalledWith(2, chunks[1], WITH_TIMESTAMPS);
    expect(getMediaInfo).toHaveBeenCalledTimes(2);
    expect(getMediaInfo).toHaveBeenNthCalledWith(1, chunks[0]);
    expect(getMediaInfo).toHaveBeenNthCalledWith(2, chunks[1]);
    expect(record.durationSeconds).toBe(500);
    expect(record.text).toBe('[00:00:02] Primeira.\n[00:05:01] Segunda.');
  });

  it('waits for each chunk duration before starting the next FFprobe request', async () => {
    const chunks = ['/tmp/chunk_000.ogg', '/tmp/chunk_001.ogg'];
    let releaseFirstProbe: (() => void) | undefined;
    let secondProbeStarted = false;
    const firstProbe = new Promise<{ durationSeconds: number }>((resolve) => {
      releaseFirstProbe = () => resolve({ durationSeconds: 300 });
    });
    const getMediaInfo = vi.fn((filePath: string) => {
      if (filePath === chunks[0]) {
        return firstProbe;
      }
      secondProbeStarted = true;
      return Promise.resolve({ durationSeconds: 200 });
    });
    const deps = makeDeps({
      getMediaInfo,
      extractAudioAndSplit: vi.fn(async () => chunks),
    });

    const transcription = transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', NO_TIMESTAMPS);

    await vi.waitFor(() => expect(getMediaInfo).toHaveBeenCalledWith(chunks[0]));
    expect(secondProbeStarted).toBe(false);
    releaseFirstProbe?.();
    await expect(transcription).resolves.toMatchObject({ durationSeconds: 500 });
  });

  it('removes the work directory when FFmpeg extraction fails', async () => {
    let workDir: string | undefined;
    const deps = makeDeps({
      extractAudioAndSplit: vi.fn(async (_input: string, outputDir: string) => {
        workDir = outputDir;
        await fs.mkdir(outputDir, { recursive: true });
        throw new Error('falha no ffmpeg');
      }),
    });

    await expect(
      transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', NO_TIMESTAMPS)
    ).rejects.toThrow('falha no ffmpeg');

    await expectDirectoryRemoved(workDir);
  });

  it('removes the work directory and rejects an empty audio extraction', async () => {
    let workDir: string | undefined;
    const deps = makeDeps({
      extractAudioAndSplit: vi.fn(async (_input: string, outputDir: string) => {
        workDir = outputDir;
        await fs.mkdir(outputDir, { recursive: true });
        return [];
      }),
    });

    await expect(
      transcribeUpload(deps, '/tmp/sem-audio.mp4', 'sem-audio.mp4', NO_TIMESTAMPS)
    ).rejects.toThrow('Não foi possível extrair áudio do arquivo enviado');

    await expectDirectoryRemoved(workDir);
  });

  it('rejects a normalized chunk with a zero duration', async () => {
    let workDir: string | undefined;
    const deps = makeDeps({
      extractAudioAndSplit: vi.fn(async (_input: string, outputDir: string) => {
        workDir = outputDir;
        return [await writeChunk(outputDir, 0)];
      }),
      getMediaInfo: vi.fn(async () => ({ durationSeconds: 0 })),
    });

    await expect(
      transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', NO_TIMESTAMPS)
    ).rejects.toMatchObject({
      name: UnsupportedMediaError.name,
      message: 'Não foi possível determinar a duração do áudio extraído',
    });

    await expectDirectoryRemoved(workDir);
  });

  it('removes the work directory and saves no record when OpenAI transcription fails', async () => {
    let workDir: string | undefined;
    const repo = createTranscriptionRepo(':memory:');
    const deps = makeDeps({
      repo,
      extractAudioAndSplit: vi.fn(async (_input: string, outputDir: string) => {
        workDir = outputDir;
        return [await writeChunk(outputDir, 0)];
      }),
      transcribeChunk: vi.fn(async () => {
        throw new Error('OpenAI indisponível');
      }),
    });

    await expect(
      transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', NO_TIMESTAMPS)
    ).rejects.toThrow('Falha ao transcrever o segmento 1 de 1');
    expect(repo.list()).toHaveLength(0);
    await expectDirectoryRemoved(workDir);
  });
});
