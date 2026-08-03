# Transcrição com Tempo das Falas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user optionally get the transcription text with the speech time embedded inline (`[HH:MM:SS] texto`), plus a language selector (Português/Inglês/Espanhol) that improves accuracy for both transcription modes — no new file format, no database schema change.

**Architecture:** The upload form gains a checkbox (checked by default) and a language dropdown, sent to `POST /api/transcribe` as extra form fields. `transcribeService.ts` branches on `withTimestamps`: with it, each chunk is transcribed via OpenAI's `whisper-1` model (`response_format: 'verbose_json'`), and per-segment timestamps are offset by the accumulated real duration of prior chunks, then formatted into `[HH:MM:SS] texto` lines that become the saved `text`. Without it, behavior is unchanged (`gpt-4o-transcribe`, plain concatenated text) except for the added `language` parameter. The client just reflects whatever `text` comes back — no changes to the preview box or the single "Baixar .txt" button.

**Tech Stack:** Node.js/TypeScript (Express), `openai` SDK v4 (`whisper-1` / `gpt-4o-transcribe`), Vitest for server-side unit tests, vanilla TS/HTML/CSS on the client (no test framework — verified manually in the browser, matching this project's existing convention).

## Global Constraints

- No database schema change — `text` already holds the final string, with or without embedded timestamps.
- Exactly one download button, always `.txt` — no `.srt`/`.vtt` export.
- Timestamp mode uses `whisper-1` (the only OpenAI-hosted model that returns `segments`); non-timestamp mode keeps `gpt-4o-transcribe`.
- Timestamp granularity is per segment/phrase, as returned natively by `whisper-1` — no word-level splitting.
- Language options are exactly `pt` (default) / `en` / `es`, sent as the OpenAI `language` parameter in both modes.
- "Adicionar tempo às falas" checkbox is **checked by default**.
- Checkbox help copy (verbatim): "Adiciona o tempo de cada trecho falado ao texto. Isso usa outro modelo de transcrição e pode reduzir um pouco a qualidade — se notar isso, tente novamente sem marcar esta opção."
- Spec reference: `docs/superpowers/specs/2026-08-03-transcricao-com-tempo-design.md`.

---

### Task 1: `openaiClient.ts` — model/response branching by mode

**Files:**
- Modify: `src/server/openaiClient.ts` (full rewrite, currently 29 lines)
- Test: `tests/server/openaiClient.test.ts` (new file)

**Interfaces:**
- Produces:
  - `interface TranscribeSegment { start: number; text: string }`
  - `interface TranscribeChunkResult { text: string; segments?: TranscribeSegment[] }`
  - `interface TranscribeChunkOptions { withTimestamps: boolean; language: string }`
  - `type TranscribeChunkFn = (filePath: string, options: TranscribeChunkOptions) => Promise<TranscribeChunkResult>`
  - `TranscriptionApiError` (unchanged, still exported from this file)
  - `createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn }` (unchanged export name/shape, new inner signature)

- [ ] **Step 1: Write the failing test file**

Create `tests/server/openaiClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: { transcriptions: { create: createMock } },
  })),
}));

vi.mock('node:fs', () => ({
  default: { createReadStream: vi.fn(() => ({})) },
}));

import { createOpenAIClient } from '../../src/server/openaiClient.js';

describe('createOpenAIClient', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('uses gpt-4o-transcribe without timestamps and returns plain text', async () => {
    createMock.mockResolvedValueOnce({ text: 'ola mundo' });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: false,
      language: 'pt',
    });
    expect(result).toEqual({ text: 'ola mundo' });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-transcribe', language: 'pt' })
    );
    expect(createMock.mock.calls[0][0]).not.toHaveProperty('response_format');
  });

  it('uses whisper-1 with verbose_json and maps segments when withTimestamps is true', async () => {
    createMock.mockResolvedValueOnce({
      text: 'ola mundo',
      segments: [
        { start: 0, end: 1.2, text: ' Ola.' },
        { start: 1.2, end: 2.5, text: ' Mundo?' },
      ],
    });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: true,
      language: 'en',
    });
    expect(result).toEqual({
      text: 'ola mundo',
      segments: [
        { start: 0, text: 'Ola.' },
        { start: 1.2, text: 'Mundo?' },
      ],
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en',
      })
    );
  });

  it('treats a response with no segments as an empty segments array', async () => {
    createMock.mockResolvedValueOnce({ text: 'sem segmentos' });
    const client = createOpenAIClient('fake-key');
    const result = await client.transcribeChunk('/tmp/a.ogg', {
      withTimestamps: true,
      language: 'pt',
    });
    expect(result).toEqual({ text: 'sem segmentos', segments: [] });
  });

  it('wraps API failures in TranscriptionApiError', async () => {
    createMock.mockRejectedValueOnce(new Error('boom'));
    const client = createOpenAIClient('fake-key');
    await expect(
      client.transcribeChunk('/tmp/a.ogg', { withTimestamps: false, language: 'pt' })
    ).rejects.toThrow('Falha ao transcrever áudio via OpenAI');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/openaiClient.test.ts`
Expected: FAIL — `createOpenAIClient`'s `transcribeChunk` doesn't accept a second argument / doesn't return an object shape yet (current implementation returns a bare string and ignores `withTimestamps`/`language`).

- [ ] **Step 3: Rewrite `src/server/openaiClient.ts`**

```ts
import fs from 'node:fs';
import OpenAI from 'openai';

export class TranscriptionApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionApiError';
  }
}

export interface TranscribeSegment {
  start: number;
  text: string;
}

export interface TranscribeChunkResult {
  text: string;
  segments?: TranscribeSegment[];
}

export interface TranscribeChunkOptions {
  withTimestamps: boolean;
  language: string;
}

export type TranscribeChunkFn = (
  filePath: string,
  options: TranscribeChunkOptions
) => Promise<TranscribeChunkResult>;

export function createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn } {
  const client = new OpenAI({ apiKey });
  return {
    async transcribeChunk(filePath, { withTimestamps, language }) {
      try {
        if (withTimestamps) {
          const response = await client.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-1',
            response_format: 'verbose_json',
            language,
          });
          return {
            text: response.text,
            segments: (response.segments ?? []).map((segment) => ({
              start: segment.start,
              text: segment.text.trim(),
            })),
          };
        }
        const response = await client.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'gpt-4o-transcribe',
          language,
        });
        return { text: response.text };
      } catch (error) {
        throw new TranscriptionApiError('Falha ao transcrever áudio via OpenAI', error);
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/openaiClient.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/openaiClient.ts tests/server/openaiClient.test.ts
git commit -m "feat: support whisper-1 timestamps and language in openaiClient"
```

---

### Task 2: `transcribeService.ts` — offset accumulation and inline timestamp formatting

**Files:**
- Modify: `src/server/transcribeService.ts` (full rewrite, currently 61 lines)
- Modify: `tests/server/transcribeService.test.ts` (full rewrite, currently 98 lines)

**Interfaces:**
- Consumes: `TranscribeChunkFn`, `TranscribeChunkOptions`, `TranscribeChunkResult` from `./openaiClient.js` (Task 1).
- Produces:
  - `interface TranscribeUploadOptions { withTimestamps: boolean; language: string }`
  - `transcribeUpload(deps: TranscribeUploadDeps, uploadedFilePath: string, originalFilename: string, options: TranscribeUploadOptions): Promise<TranscriptionRecord>` — note the new required 4th parameter (Task 3's `routes.ts` change relies on this exact signature).

- [ ] **Step 1: Rewrite the test file with updated mocks and new timestamp-path tests**

Replace `tests/server/transcribeService.test.ts` entirely with:

```ts
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
  });

  it('produces empty text when withTimestamps is true but the response has no segments', async () => {
    const deps = makeDeps({
      transcribeChunk: vi.fn(async () => ({ text: 'ignorado' })),
    });
    const record = await transcribeUpload(deps, '/tmp/audio.ogg', 'audio.ogg', WITH_TIMESTAMPS);
    expect(record.text).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run tests/server/transcribeService.test.ts`
Expected: FAIL on the two new tests (`transcribeUpload` doesn't accept a 4th `options` argument yet and always concatenates with spaces). The other tests will also fail to compile/run since every call site now passes an extra argument the current function signature doesn't declare.

- [ ] **Step 3: Rewrite `src/server/transcribeService.ts`**

```ts
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
        for (const segment of result.segments ?? []) {
          timestampedLines.push(`[${formatTimestamp(offsetSeconds + segment.start)}] ${segment.text}`);
        }
        const chunkInfo = await deps.getAudioInfo(chunkPaths[i]);
        offsetSeconds += chunkInfo.durationSeconds;
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/server/transcribeService.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/transcribeService.ts tests/server/transcribeService.test.ts
git commit -m "feat: accumulate chunk offsets and format inline timestamps in transcribeUpload"
```

---

### Task 3: `routes.ts` — parse and wire `withTimestamps`/`language` from the request

**Files:**
- Modify: `src/server/routes.ts:1-59` (imports + inside `createRouter`, the `/transcribe` handler)
- Modify: `tests/server/routes.test.ts` (update the `transcribeChunk` mock shape used in `beforeEach`; add a new `describe` block for the new helper)

**Interfaces:**
- Consumes: `transcribeUpload(deps, filePath, filename, options)` from `./transcribeService.js` (Task 2) — the 4th argument is now required.
- Produces: `parseTranscribeOptions(body: Record<string, unknown>): TranscribeUploadOptions`, exported from `routes.ts` for direct unit testing (avoids needing a real audio fixture to exercise this logic through the full HTTP/ffprobe stack).

- [ ] **Step 1: Add failing tests**

In `tests/server/routes.test.ts`, first change the `beforeEach` mock (the current `transcribeChunk: vi.fn(async () => 'texto')` returns a bare string, which no longer matches `TranscribeChunkFn`'s return type from Task 1):

```ts
  beforeEach(() => {
    repo = createTranscriptionRepo(':memory:');
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk: vi.fn(async () => ({ text: 'texto' })) }));
  });
```

Then update the existing routes import at the top of the file to also bring in `parseTranscribeOptions`:

```ts
import { createRouter, parseTranscribeOptions } from '../../src/server/routes.js';
```

Then add this `describe` block at the end of the file (append after the existing `describe('routes', ...)` block):

```ts
describe('parseTranscribeOptions', () => {
  it('defaults to withTimestamps=false and language=pt when the body is empty', () => {
    expect(parseTranscribeOptions({})).toEqual({ withTimestamps: false, language: 'pt' });
  });

  it('parses withTimestamps=true and a valid language from string fields', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'true', language: 'en' })).toEqual({
      withTimestamps: true,
      language: 'en',
    });
  });

  it('treats any value other than the string "true" as withTimestamps=false', () => {
    expect(parseTranscribeOptions({ withTimestamps: 'yes' })).toEqual({
      withTimestamps: false,
      language: 'pt',
    });
  });

  it('falls back to pt for an unsupported language', () => {
    expect(parseTranscribeOptions({ language: 'fr' })).toEqual({
      withTimestamps: false,
      language: 'pt',
    });
  });

  it('accepts es as a valid language', () => {
    expect(parseTranscribeOptions({ language: 'es' })).toEqual({
      withTimestamps: false,
      language: 'es',
    });
  });
});
```

(Add the new `import` line at the top of the file alongside the existing imports, not inline — put it right after `import { createTranscriptionRepo, ... } from '../../src/server/db.js';`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/routes.test.ts`
Expected: FAIL — `parseTranscribeOptions` is not exported yet, and the existing `/transcribe`-adjacent tests fail to compile against the updated `transcribeChunk` mock/`transcribeUpload` signature until routes.ts is updated in the next step.

- [ ] **Step 3: Update `src/server/routes.ts`**

Add near the top of the file, after the existing imports (after the `transcribeUpload` import line):

```ts
import { transcribeUpload, type TranscribeUploadOptions } from './transcribeService.js';

const ALLOWED_LANGUAGES = new Set(['pt', 'en', 'es']);

export function parseTranscribeOptions(body: Record<string, unknown>): TranscribeUploadOptions {
  const language =
    typeof body.language === 'string' && ALLOWED_LANGUAGES.has(body.language)
      ? body.language
      : 'pt';
  return {
    withTimestamps: body.withTimestamps === 'true',
    language,
  };
}
```

Then update the `/transcribe` handler (replace the existing `router.post('/transcribe', ...)` block) to read the options and pass them through:

```ts
  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
      return;
    }
    const options = parseTranscribeOptions(req.body);
    try {
      const record = await transcribeUpload(
        {
          repo: deps.repo,
          transcribeChunk: deps.transcribeChunk,
          getAudioInfo,
          compressAndSplit,
        },
        req.file.path,
        req.file.originalname,
        options
      );
      res.status(200).json(record);
    } catch (error) {
      if (error instanceof UnsupportedAudioError) {
        console.error(error.message, error.cause);
        res.status(400).json({ error: 'Formato de áudio não suportado' });
      } else if (error instanceof TranscriptionApiError) {
        res.status(502).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erro interno ao transcrever o áudio' });
      }
    } finally {
      await fs.rm(req.file.path, { force: true });
    }
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/server/routes.test.ts`
Expected: PASS (all existing tests + 5 new `parseTranscribeOptions` tests)

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: All green — this confirms Tasks 1–3 compose correctly end to end.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes.ts tests/server/routes.test.ts
git commit -m "feat: parse withTimestamps/language from the transcribe request body"
```

---

### Task 4: Client UI — timestamp checkbox and language dropdown

**Files:**
- Modify: `src/client/index.html:48-77` (inside `#upload-section`)
- Modify: `src/client/style.css` (append new rules at the end of the file)
- Modify: `src/client/main.ts:20-30` (element references) and `src/client/main.ts:102-125` (`transcribeBtn` click handler)

**Interfaces:**
- Consumes: the server now accepts `withTimestamps` (`'true'`/`'false'`) and `language` (`'pt'`/`'en'`/`'es'`) as additional multipart form fields on `POST /api/transcribe` (Task 3).
- No test file — this project has no client-side test setup (`vitest.config.ts` runs with `environment: 'node'`, and `main.ts` touches `document` at module scope, so it can't be imported in a Node test). Verified manually per Step 5 below, matching this project's existing testing scope (see `docs/superpowers/specs/2026-08-01-transcritor-design.md`, "Testes" section: "Sem testes E2E automatizados — verificação manual no navegador").

- [ ] **Step 1: Add the checkbox and language dropdown to `src/client/index.html`**

In the `#upload-section` card, insert a new `<div class="upload-options">` between the closing `</label>` of `#drop-zone` (line 69) and the `#transcribe-btn` button (line 70):

```html
          <div class="upload-options">
            <label class="checkbox-field">
              <input id="timestamps-checkbox" type="checkbox" checked />
              <span>
                Adicionar tempo às falas
                <small
                  >Adiciona o tempo de cada trecho falado ao texto. Isso usa outro modelo de
                  transcrição e pode reduzir um pouco a qualidade — se notar isso, tente
                  novamente sem marcar esta opção.</small
                >
              </span>
            </label>
            <label class="field field-inline">
              <span>Idioma</span>
              <select id="language-select">
                <option value="pt" selected>Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </label>
          </div>
```

- [ ] **Step 2: Add styles to `src/client/style.css`**

Append at the end of the file (after the existing `@media (prefers-reduced-motion: reduce)` block):

```css

.upload-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.checkbox-field {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: 0.9375rem;
  color: var(--ctp-text);
  cursor: pointer;
}

.checkbox-field input[type='checkbox'] {
  margin-top: 0.2em;
  width: 1rem;
  height: 1rem;
  accent-color: var(--ctp-mauve);
  cursor: pointer;
}

.checkbox-field small {
  display: block;
  color: var(--ctp-subtext0);
  font-size: 0.8125rem;
  font-weight: 400;
  margin-top: 0.125rem;
}

.field-inline {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 0;
}

.field-inline select {
  background: var(--ctp-mantle);
  border: 1px solid var(--ctp-surface1);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  font-size: 0.9375rem;
  color: var(--ctp-text);
}

.field-inline select:focus-visible {
  outline: 2px solid var(--ctp-mauve);
  outline-offset: 1px;
}
```

- [ ] **Step 3: Wire the new controls in `src/client/main.ts`**

Add two new element references after the existing `historyEmpty` line (line 29):

```ts
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;
const timestampsCheckbox = document.getElementById('timestamps-checkbox') as HTMLInputElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
```

Then update the `transcribeBtn` click handler's `formData` construction (currently just `formData.append('audio', selectedFile);` around line 109) to also send the two new fields:

```ts
  const formData = new FormData();
  formData.append('audio', selectedFile);
  formData.append('withTimestamps', String(timestampsCheckbox.checked));
  formData.append('language', languageSelect.value);
```

- [ ] **Step 4: Run the full automated suite and typecheck (no client tests exist, but this confirms nothing server-side broke)**

Run: `npm test && npm run typecheck`
Expected: All green.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`

1. Open the app, log in, and confirm the "Adicionar tempo às falas" checkbox appears under the drop zone, **checked by default**, with the help text visible underneath, and the "Idioma" dropdown next to it defaulting to "Português".
2. Upload a short audio file with the checkbox checked (default) → after transcription completes, confirm the result textarea shows lines like `[00:00:03] ...` and that "Baixar .txt" downloads that same text.
3. Uncheck the checkbox, upload again → confirm the result textarea shows plain text with no `[HH:MM:SS]` markers (same as before this feature).
4. Switch the language dropdown to "Inglês" or "Espanhol" before transcribing an audio file in that language → confirm the app still completes successfully (exact transcription content isn't asserted, just that the request succeeds end to end).
5. Open a past item from "Histórico" that was transcribed with timestamps → confirm it re-displays the timestamped text correctly (this works automatically since `text` already contains everything, no new history code was written).

- [ ] **Step 6: Commit**

```bash
git add src/client/index.html src/client/style.css src/client/main.ts
git commit -m "feat: add timestamp checkbox and language selector to the upload form"
```
