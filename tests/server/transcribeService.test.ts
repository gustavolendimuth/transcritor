import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { transcribeUpload, type TranscribeUploadDeps } from '../../src/server/transcribeService.js';
import { createTranscriptionRepo } from '../../src/server/db.js';

const NO_TIMESTAMPS = { withTimestamps: false, language: 'pt' } as const;
const WITH_TIMESTAMPS = { withTimestamps: true, language: 'pt' } as const;

function makeDeps(overrides: Partial<TranscribeUploadDeps> = {}): TranscribeUploadDeps {
  return {
    repo: createTranscriptionRepo(':memory:'),
    transcribeChunk: vi.fn(async () => ({ text: 'texto' })),
    getAudioInfo: vi.fn(async () => ({ durationSeconds: 60, sizeBytes: 1024 })),
    compressAndSplit: vi.fn(async () => []),
    ...overrides,
  };
}

describe('transcribeUpload', () => {
  it('transcribes a short file without splitting and saves it', async () => {
    const deps = makeDeps();
    const record = await transcribeUpload(deps, '/tmp/audio.ogg', 'audio.ogg', NO_TIMESTAMPS);
    expect(deps.transcribeChunk).toHaveBeenCalledTimes(1);
    expect(deps.transcribeChunk).toHaveBeenCalledWith('/tmp/audio.ogg', NO_TIMESTAMPS);
    expect(deps.compressAndSplit).not.toHaveBeenCalled();
    expect(record.text).toBe('texto');
    expect(record.filename).toBe('audio.ogg');
    expect(record.withTimestamps).toBe(false);
  });

  it('concatenates chunk texts in order for long files', async () => {
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce({ text: 'parte um.' })
      .mockResolvedValueOnce({ text: 'parte dois.' });
    const deps = makeDeps({
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    const record = await transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', NO_TIMESTAMPS);
    expect(transcribeChunk).toHaveBeenNthCalledWith(1, '/tmp/chunk_00.ogg', NO_TIMESTAMPS);
    expect(transcribeChunk).toHaveBeenNthCalledWith(2, '/tmp/chunk_01.ogg', NO_TIMESTAMPS);
    expect(record.text).toBe('parte um. parte dois.');
  });

  it('does not save anything if a chunk fails to transcribe', async () => {
    const repo = createTranscriptionRepo(':memory:');
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce({ text: 'parte um.' })
      .mockRejectedValueOnce(new Error('falha na API'));
    const deps = makeDeps({
      repo,
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    await expect(
      transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', NO_TIMESTAMPS)
    ).rejects.toThrow('Falha ao transcrever o segmento 2 de 2');
    expect(repo.list()).toHaveLength(0);
  });

  it('does not save anything if compressAndSplit fails', async () => {
    const repo = createTranscriptionRepo(':memory:');
    let capturedWorkDir: string | undefined;
    const compressAndSplit = vi.fn(async (_input: string, outputDir: string) => {
      capturedWorkDir = outputDir;
      throw new Error('falha no ffmpeg');
    });
    const deps = makeDeps({
      repo,
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit,
    });
    const rmSpy = vi.spyOn(fs, 'rm');
    try {
      await expect(
        transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', NO_TIMESTAMPS)
      ).rejects.toThrow('falha no ffmpeg');
      expect(repo.list()).toHaveLength(0);
      expect(capturedWorkDir).toBeDefined();
      expect(rmSpy).toHaveBeenCalledWith(capturedWorkDir, { recursive: true, force: true });
    } finally {
      rmSpy.mockRestore();
    }
  });

  it('rejects with UnsupportedAudioError when compressAndSplit produces no chunks', async () => {
    const repo = createTranscriptionRepo(':memory:');
    const deps = makeDeps({
      repo,
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit: vi.fn(async () => []),
    });
    await expect(
      transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', NO_TIMESTAMPS)
    ).rejects.toThrow('Não foi possível extrair áudio do arquivo enviado');
    expect(repo.list()).toHaveLength(0);
  });

  it('formats segments into timestamped lines with an accumulated offset across chunks', async () => {
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce({
        text: 'ola tudo bem',
        segments: [
          { start: 0, text: 'Ola.' },
          { start: 2.5, text: 'Tudo bem?' },
        ],
      })
      .mockResolvedValueOnce({
        text: 'aqui e a parte dois',
        segments: [{ start: 1, text: 'Aqui é a parte dois.' }],
      });
    const getAudioInfo = vi
      .fn()
      .mockResolvedValueOnce({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })
      .mockResolvedValueOnce({ durationSeconds: 300, sizeBytes: 5 * 1024 * 1024 })
      .mockResolvedValueOnce({ durationSeconds: 200, sizeBytes: 4 * 1024 * 1024 });
    const deps = makeDeps({
      getAudioInfo,
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    const record = await transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', WITH_TIMESTAMPS);
    expect(record.text).toBe(
      '[00:00:00] Ola.\n[00:00:02] Tudo bem?\n[00:05:01] Aqui é a parte dois.'
    );
    expect(transcribeChunk).toHaveBeenNthCalledWith(1, '/tmp/chunk_00.ogg', WITH_TIMESTAMPS);
    expect(transcribeChunk).toHaveBeenNthCalledWith(2, '/tmp/chunk_01.ogg', WITH_TIMESTAMPS);
    expect(record.withTimestamps).toBe(true);
  });

  it('falls back to chunk text for chunks with no segments while other chunks still use real segments', async () => {
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce({
        text: 'ola tudo bem',
        segments: [{ start: 0, text: 'Ola.' }],
      })
      .mockResolvedValueOnce({ text: 'sem segmentos aqui' });
    const getAudioInfo = vi
      .fn()
      .mockResolvedValueOnce({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })
      .mockResolvedValueOnce({ durationSeconds: 300, sizeBytes: 5 * 1024 * 1024 });
    const deps = makeDeps({
      getAudioInfo,
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    const record = await transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg', WITH_TIMESTAMPS);
    expect(record.text).toBe('[00:00:00] Ola.\n[00:05:00] sem segmentos aqui');
  });

  it('falls back to the chunk text prefixed with its offset when withTimestamps is true but the response has no segments', async () => {
    const deps = makeDeps({
      transcribeChunk: vi.fn(async () => ({ text: 'ignorado' })),
    });
    const record = await transcribeUpload(deps, '/tmp/audio.ogg', 'audio.ogg', WITH_TIMESTAMPS);
    expect(record.text).toBe('[00:00:00] ignorado');
  });
});
