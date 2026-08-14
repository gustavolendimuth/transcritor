import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { transcribeUpload, type TranscribeUploadDeps } from '../../src/server/transcribeService.js';
import { createTranscriptionRepo } from '../../src/server/db.js';

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
  it('converts even a short uploaded media file before transcribing it and removes the work directory', async () => {
    let workDir: string | undefined;
    const extractAudioAndSplit = vi.fn(async (_input: string, outputDir: string) => {
      workDir = outputDir;
      return [await writeChunk(outputDir, 0)];
    });
    const transcribeChunk = vi.fn(async () => ({ text: 'texto normalizado' }));
    const deps = makeDeps({ extractAudioAndSplit, transcribeChunk });

    const record = await transcribeUpload(deps, '/tmp/aula-curta.mp4', 'aula-curta.mp4', NO_TIMESTAMPS);

    expect(extractAudioAndSplit).toHaveBeenCalledWith('/tmp/aula-curta.mp4', expect.any(String));
    expect(transcribeChunk).toHaveBeenCalledWith(
      expect.stringMatching(/chunk_000\.ogg$/),
      NO_TIMESTAMPS
    );
    expect(record).toMatchObject({
      filename: 'aula-curta.mp4',
      text: 'texto normalizado',
      durationSeconds: 60,
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
      .mockResolvedValueOnce({ durationSeconds: 700 })
      .mockResolvedValueOnce({ durationSeconds: 300 });
    const deps = makeDeps({
      getMediaInfo,
      extractAudioAndSplit: vi.fn(async () => chunks),
      transcribeChunk,
    });

    const record = await transcribeUpload(deps, '/tmp/aula.mp4', 'aula.mp4', WITH_TIMESTAMPS);

    expect(transcribeChunk).toHaveBeenNthCalledWith(1, chunks[0], WITH_TIMESTAMPS);
    expect(transcribeChunk).toHaveBeenNthCalledWith(2, chunks[1], WITH_TIMESTAMPS);
    expect(record.text).toBe('[00:00:02] Primeira.\n[00:05:01] Segunda.');
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
