# Transcritor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal web app that transcribes audio files via the OpenAI `gpt-4o-transcribe` model, handling large/long audio automatically, with a persisted history, deployed as a single service on Railway.

**Architecture:** A single Express + TypeScript service serves both a small Vite-built vanilla-TS frontend (static files) and a JSON API. Long/large uploads are compressed and split with `ffmpeg`/`ffprobe` before being sent to OpenAI in chunks, then the chunk texts are concatenated and saved to a SQLite database (`better-sqlite3`) on a Railway volume. The whole service sits behind HTTP Basic Auth.

**Tech Stack:** Node.js, TypeScript (ESM, run via `tsx`), Express, `better-sqlite3`, `multer`, `openai` SDK, Vite (vanilla-ts), Vitest + Supertest, Railway (nixpacks).

## Global Constraints

- Transcription model: `gpt-4o-transcribe` (OpenAI `/v1/audio/transcriptions`).
- Upload limit accepted by the server: 100MB per file (multipart).
- Processing threshold: if a file is >25MB **or** >10 minutes (600s) long, compress to mono Opus 32kbps and split into 5-minute (300s) segments before sending to OpenAI; otherwise send the original file as-is.
- Auth: HTTP Basic Auth over the entire app, credentials from env vars `AUTH_USER` / `AUTH_PASSWORD`.
- History persisted in SQLite via `better-sqlite3`; DB path configurable via env var `DB_PATH` (Railway: a mounted volume, e.g. `/data/transcricoes.db`).
- No user accounts, no async job queue, no browser microphone recording — explicitly out of scope per the approved spec.
- All code in TypeScript, ESM modules (`"type": "module"` in `package.json`).
- Spec reference: `docs/superpowers/specs/2026-08-01-transcritor-design.md`.

---

### Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `test`, `typecheck` that every later task relies on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "transcritor",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "dev": "concurrently -n server,client -c blue,green \"npm:dev:server\" \"npm:dev:client\"",
    "build": "vite build",
    "start": "tsx src/server/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.19.2",
    "multer": "^2.0.0",
    "openai": "^4.70.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.5.0",
    "@types/supertest": "^6.0.2",
    "concurrently": "^8.2.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /home/gustavolendimuth/projetos/transcritor && npm install`
Expected: installs without errors, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
data/
.env
*.log
```

- [ ] **Step 6: Create `.env.example`**

```
PORT=3001
OPENAI_API_KEY=
AUTH_USER=
AUTH_PASSWORD=
DB_PATH=./data/transcricoes.db
```

- [ ] **Step 7: Verify tooling**

Run: `npm run typecheck`
Expected: no errors (no `.ts` files exist yet, so this is a no-op success).

Run: `npm test`
Expected: `vitest` reports "No test files found" without crashing (exit code may be non-zero for "no tests" — that's fine at this stage, later tasks add real tests).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore .env.example
git commit -m "chore: scaffold TypeScript project with Vite, Vitest and Railway tooling"
```

---

### Task 2: SQLite transcription repository

**Files:**
- Create: `src/server/db.ts`
- Test: `tests/server/db.test.ts`

**Interfaces:**
- Produces:
  - `interface TranscriptionRecord { id: number; filename: string; text: string; durationSeconds: number; createdAt: string }`
  - `interface TranscriptionRepo { insert(record: {filename: string; text: string; durationSeconds: number}): TranscriptionRecord; list(): TranscriptionRecord[]; get(id: number): TranscriptionRecord | undefined; remove(id: number): boolean; close(): void }`
  - `function createTranscriptionRepo(dbPath: string): TranscriptionRepo`

- [ ] **Step 1: Write the failing test**

Create `tests/server/db.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTranscriptionRepo, type TranscriptionRepo } from '../../src/server/db.js';

describe('createTranscriptionRepo', () => {
  let repo: TranscriptionRepo;

  beforeEach(() => {
    repo = createTranscriptionRepo(':memory:');
  });

  afterEach(() => {
    repo.close();
  });

  it('inserts a transcription and returns it with id and createdAt', () => {
    const record = repo.insert({ filename: 'audio.ogg', text: 'ola mundo', durationSeconds: 12.5 });
    expect(record.id).toBeTypeOf('number');
    expect(record.filename).toBe('audio.ogg');
    expect(record.text).toBe('ola mundo');
    expect(record.durationSeconds).toBe(12.5);
    expect(record.createdAt).toBeTypeOf('string');
  });

  it('lists transcriptions most recent first', () => {
    repo.insert({ filename: 'first.ogg', text: 'primeiro', durationSeconds: 1 });
    repo.insert({ filename: 'second.ogg', text: 'segundo', durationSeconds: 2 });
    const list = repo.list();
    expect(list).toHaveLength(2);
    expect(list[0].filename).toBe('second.ogg');
    expect(list[1].filename).toBe('first.ogg');
  });

  it('gets a transcription by id', () => {
    const inserted = repo.insert({ filename: 'audio.ogg', text: 'texto', durationSeconds: 3 });
    const found = repo.get(inserted.id);
    expect(found).toEqual(inserted);
  });

  it('returns undefined for a missing id', () => {
    expect(repo.get(999)).toBeUndefined();
  });

  it('removes a transcription by id', () => {
    const inserted = repo.insert({ filename: 'audio.ogg', text: 'texto', durationSeconds: 3 });
    expect(repo.remove(inserted.id)).toBe(true);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('returns false when removing a missing id', () => {
    expect(repo.remove(999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/db.test.ts`
Expected: FAIL — `Cannot find module '../../src/server/db.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/db.ts`:

```ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  durationSeconds: number;
  createdAt: string;
}

export interface TranscriptionRepo {
  insert(record: { filename: string; text: string; durationSeconds: number }): TranscriptionRecord;
  list(): TranscriptionRecord[];
  get(id: number): TranscriptionRecord | undefined;
  remove(id: number): boolean;
  close(): void;
}

interface TranscriptionRow {
  id: number;
  filename: string;
  text: string;
  duration_seconds: number;
  created_at: string;
}

function rowToRecord(row: TranscriptionRow): TranscriptionRecord {
  return {
    id: row.id,
    filename: row.filename,
    text: row.text,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
  };
}

export function createTranscriptionRepo(dbPath: string): TranscriptionRepo {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      text TEXT NOT NULL,
      duration_seconds REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return {
    insert({ filename, text, durationSeconds }) {
      const stmt = db.prepare(
        'INSERT INTO transcriptions (filename, text, duration_seconds) VALUES (?, ?, ?)'
      );
      const info = stmt.run(filename, text, durationSeconds);
      const row = db
        .prepare('SELECT * FROM transcriptions WHERE id = ?')
        .get(info.lastInsertRowid) as TranscriptionRow;
      return rowToRecord(row);
    },
    list() {
      const rows = db
        .prepare('SELECT * FROM transcriptions ORDER BY created_at DESC')
        .all() as TranscriptionRow[];
      return rows.map(rowToRecord);
    },
    get(id) {
      const row = db.prepare('SELECT * FROM transcriptions WHERE id = ?').get(id) as
        | TranscriptionRow
        | undefined;
      return row ? rowToRecord(row) : undefined;
    },
    remove(id) {
      const info = db.prepare('DELETE FROM transcriptions WHERE id = ?').run(id);
      return info.changes > 0;
    },
    close() {
      db.close();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/db.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/db.ts tests/server/db.test.ts
git commit -m "feat: add SQLite transcription repository"
```

---

### Task 3: Audio processing — decision logic and ffmpeg wrappers

**Files:**
- Create: `src/server/audio.ts`
- Test: `tests/server/audio.test.ts`

**Interfaces:**
- Produces:
  - `class UnsupportedAudioError extends Error`
  - `interface AudioInfo { durationSeconds: number; sizeBytes: number }`
  - `interface ProcessingPlan { needsProcessing: boolean; chunkCount: number }`
  - `function planProcessing(info: AudioInfo): ProcessingPlan`
  - `function getAudioInfo(filePath: string): Promise<AudioInfo>`
  - `function compressAndSplit(inputPath: string, outputDir: string): Promise<string[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/server/audio.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { planProcessing } from '../../src/server/audio.js';

describe('planProcessing', () => {
  it('does not process small, short audio', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 120 });
    expect(plan).toEqual({ needsProcessing: false, chunkCount: 1 });
  });

  it('processes audio over the 25MB size limit', () => {
    const plan = planProcessing({ sizeBytes: 30 * 1024 * 1024, durationSeconds: 120 });
    expect(plan.needsProcessing).toBe(true);
  });

  it('processes audio over the 10 minute duration limit', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 700 });
    expect(plan.needsProcessing).toBe(true);
  });

  it('splits into 5-minute chunks, rounding up', () => {
    const plan = planProcessing({ sizeBytes: 5 * 1024 * 1024, durationSeconds: 1141 });
    expect(plan.chunkCount).toBe(4);
  });

  it('never returns zero chunks for a zero-duration edge case', () => {
    const plan = planProcessing({ sizeBytes: 30 * 1024 * 1024, durationSeconds: 0 });
    expect(plan.chunkCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/audio.test.ts`
Expected: FAIL — `Cannot find module '../../src/server/audio.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/audio.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/audio.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/audio.ts tests/server/audio.test.ts
git commit -m "feat: add audio processing decision logic and ffmpeg wrappers"
```

---

### Task 4: OpenAI transcription client

**Files:**
- Create: `src/server/openaiClient.ts`

**Interfaces:**
- Consumes: none (leaf module wrapping the `openai` npm SDK).
- Produces:
  - `class TranscriptionApiError extends Error`
  - `type TranscribeChunkFn = (filePath: string) => Promise<string>`
  - `function createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn }`

No automated test for this task: it is a thin wrapper around a real network call to the OpenAI API, which the approved spec explicitly excludes from the automated test scope. It is exercised by the manual end-to-end verification in Task 11.

- [ ] **Step 1: Write the implementation**

Create `src/server/openaiClient.ts`:

```ts
import fs from 'node:fs';
import OpenAI from 'openai';

export class TranscriptionApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TranscriptionApiError';
  }
}

export type TranscribeChunkFn = (filePath: string) => Promise<string>;

export function createOpenAIClient(apiKey: string): { transcribeChunk: TranscribeChunkFn } {
  const client = new OpenAI({ apiKey });
  return {
    async transcribeChunk(filePath: string): Promise<string> {
      try {
        const response = await client.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'gpt-4o-transcribe',
        });
        return response.text;
      } catch (error) {
        throw new TranscriptionApiError('Falha ao transcrever áudio via OpenAI', error);
      }
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/openaiClient.ts
git commit -m "feat: add OpenAI gpt-4o-transcribe client wrapper"
```

---

### Task 5: Transcription orchestration service

**Files:**
- Create: `src/server/transcribeService.ts`
- Test: `tests/server/transcribeService.test.ts`

**Interfaces:**
- Consumes:
  - `planProcessing`, `type AudioInfo` from `./audio.js` (Task 3)
  - `type TranscribeChunkFn` from `./openaiClient.js` (Task 4)
  - `type TranscriptionRepo`, `type TranscriptionRecord` from `./db.js` (Task 2)
- Produces:
  - `interface TranscribeUploadDeps { repo: TranscriptionRepo; transcribeChunk: TranscribeChunkFn; getAudioInfo: (filePath: string) => Promise<AudioInfo>; compressAndSplit: (inputPath: string, outputDir: string) => Promise<string[]> }`
  - `function transcribeUpload(deps: TranscribeUploadDeps, uploadedFilePath: string, originalFilename: string): Promise<TranscriptionRecord>`

- [ ] **Step 1: Write the failing test**

Create `tests/server/transcribeService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { transcribeUpload, type TranscribeUploadDeps } from '../../src/server/transcribeService.js';
import { createTranscriptionRepo } from '../../src/server/db.js';

function makeDeps(overrides: Partial<TranscribeUploadDeps> = {}): TranscribeUploadDeps {
  return {
    repo: createTranscriptionRepo(':memory:'),
    transcribeChunk: vi.fn(async () => 'texto'),
    getAudioInfo: vi.fn(async () => ({ durationSeconds: 60, sizeBytes: 1024 })),
    compressAndSplit: vi.fn(async () => []),
    ...overrides,
  };
}

describe('transcribeUpload', () => {
  it('transcribes a short file without splitting and saves it', async () => {
    const deps = makeDeps();
    const record = await transcribeUpload(deps, '/tmp/audio.ogg', 'audio.ogg');
    expect(deps.transcribeChunk).toHaveBeenCalledTimes(1);
    expect(deps.transcribeChunk).toHaveBeenCalledWith('/tmp/audio.ogg');
    expect(deps.compressAndSplit).not.toHaveBeenCalled();
    expect(record.text).toBe('texto');
    expect(record.filename).toBe('audio.ogg');
  });

  it('concatenates chunk texts in order for long files', async () => {
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce('parte um.')
      .mockResolvedValueOnce('parte dois.');
    const deps = makeDeps({
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    const record = await transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg');
    expect(transcribeChunk).toHaveBeenNthCalledWith(1, '/tmp/chunk_00.ogg');
    expect(transcribeChunk).toHaveBeenNthCalledWith(2, '/tmp/chunk_01.ogg');
    expect(record.text).toBe('parte um. parte dois.');
  });

  it('does not save anything if a chunk fails to transcribe', async () => {
    const repo = createTranscriptionRepo(':memory:');
    const transcribeChunk = vi
      .fn()
      .mockResolvedValueOnce('parte um.')
      .mockRejectedValueOnce(new Error('falha na API'));
    const deps = makeDeps({
      repo,
      getAudioInfo: vi.fn(async () => ({ durationSeconds: 700, sizeBytes: 30 * 1024 * 1024 })),
      compressAndSplit: vi.fn(async () => ['/tmp/chunk_00.ogg', '/tmp/chunk_01.ogg']),
      transcribeChunk,
    });
    await expect(transcribeUpload(deps, '/tmp/long.ogg', 'long.ogg')).rejects.toThrow(
      'falha na API'
    );
    expect(repo.list()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/transcribeService.test.ts`
Expected: FAIL — `Cannot find module '../../src/server/transcribeService.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/transcribeService.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/transcribeService.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/transcribeService.ts tests/server/transcribeService.test.ts
git commit -m "feat: add transcription orchestration service"
```

---

### Task 6: HTTP Basic Auth middleware

**Files:**
- Create: `src/server/auth.ts`
- Test: `tests/server/auth.test.ts`

**Interfaces:**
- Produces: `function basicAuthMiddleware(username: string, password: string): (req: Request, res: Response, next: NextFunction) => void`

- [ ] **Step 1: Write the failing test**

Create `tests/server/auth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { basicAuthMiddleware } from '../../src/server/auth.js';

function makeRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function encode(user: string, pass: string) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('basicAuthMiddleware', () => {
  const middleware = basicAuthMiddleware('gustavo', 'segredo123');

  it('calls next() with correct credentials', () => {
    const req = { headers: { authorization: encode('gustavo', 'segredo123') } } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('rejects missing credentials with 401', () => {
    const req = { headers: {} } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Basic');
  });

  it('rejects wrong password with 401', () => {
    const req = { headers: { authorization: encode('gustavo', 'errada') } } as any;
    const res = makeRes() as any;
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/auth.test.ts`
Expected: FAIL — `Cannot find module '../../src/server/auth.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/auth.ts`:

```ts
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function basicAuthMiddleware(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex !== -1) {
        const user = decoded.slice(0, separatorIndex);
        const pass = decoded.slice(separatorIndex + 1);
        if (safeEqual(user, username) && safeEqual(pass, password)) {
          next();
          return;
        }
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Transcritor"');
    res.status(401).send('Autenticação necessária');
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/auth.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts tests/server/auth.test.ts
git commit -m "feat: add HTTP Basic Auth middleware"
```

---

### Task 7: Express routes and API integration tests

**Files:**
- Create: `src/server/routes.ts`
- Test: `tests/server/routes.test.ts`

**Interfaces:**
- Consumes:
  - `type TranscriptionRepo` from `./db.js` (Task 2)
  - `UnsupportedAudioError`, `getAudioInfo`, `compressAndSplit` from `./audio.js` (Task 3)
  - `TranscriptionApiError`, `type TranscribeChunkFn` from `./openaiClient.js` (Task 4)
  - `transcribeUpload` from `./transcribeService.js` (Task 5)
- Produces:
  - `interface RouterDeps { repo: TranscriptionRepo; transcribeChunk: TranscribeChunkFn }`
  - `function createRouter(deps: RouterDeps): express.Router` mounting `POST /transcribe`, `GET /history`, `GET /history/:id`, `DELETE /history/:id`

- [ ] **Step 1: Write the failing test**

Create `tests/server/routes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRouter } from '../../src/server/routes.js';
import { createTranscriptionRepo, type TranscriptionRepo } from '../../src/server/db.js';

describe('routes', () => {
  let repo: TranscriptionRepo;
  let app: express.Express;

  beforeEach(() => {
    repo = createTranscriptionRepo(':memory:');
    app = express();
    app.use('/api', createRouter({ repo, transcribeChunk: vi.fn(async () => 'texto') }));
  });

  afterEach(() => {
    repo.close();
  });

  it('POST /api/transcribe without a file returns 400', async () => {
    const res = await request(app).post('/api/transcribe');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf('string');
  });

  it('GET /api/history returns an empty list initially', async () => {
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/history returns saved transcriptions most recent first', async () => {
    repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    repo.insert({ filename: 'b.ogg', text: 'b', durationSeconds: 2 });
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].filename).toBe('b.ogg');
  });

  it('GET /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).get('/api/history/999');
    expect(res.status).toBe(404);
  });

  it('GET /api/history/:id returns the record when it exists', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    const res = await request(app).get(`/api/history/${inserted.id}`);
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('a.ogg');
  });

  it('DELETE /api/history/:id removes an existing record', async () => {
    const inserted = repo.insert({ filename: 'a.ogg', text: 'a', durationSeconds: 1 });
    const res = await request(app).delete(`/api/history/${inserted.id}`);
    expect(res.status).toBe(204);
    expect(repo.get(inserted.id)).toBeUndefined();
  });

  it('DELETE /api/history/:id returns 404 for a missing id', async () => {
    const res = await request(app).delete('/api/history/999');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/routes.test.ts`
Expected: FAIL — `Cannot find module '../../src/server/routes.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/routes.ts`:

```ts
import { Router } from 'express';
import multer from 'multer';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { TranscriptionRepo } from './db.js';
import { UnsupportedAudioError, getAudioInfo, compressAndSplit } from './audio.js';
import { TranscriptionApiError, type TranscribeChunkFn } from './openaiClient.js';
import { transcribeUpload } from './transcribeService.js';

export interface RouterDeps {
  repo: TranscriptionRepo;
  transcribeChunk: TranscribeChunkFn;
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();
  const upload = multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de áudio enviado' });
      return;
    }
    try {
      const record = await transcribeUpload(
        {
          repo: deps.repo,
          transcribeChunk: deps.transcribeChunk,
          getAudioInfo,
          compressAndSplit,
        },
        req.file.path,
        req.file.originalname
      );
      res.status(200).json(record);
    } catch (error) {
      if (error instanceof UnsupportedAudioError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof TranscriptionApiError) {
        res.status(502).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Erro interno ao transcrever o áudio' });
      }
    } finally {
      await fs.rm(req.file.path, { force: true });
    }
  });

  router.get('/history', (_req, res) => {
    res.status(200).json(deps.repo.list());
  });

  router.get('/history/:id', (req, res) => {
    const id = Number(req.params.id);
    const record = deps.repo.get(id);
    if (!record) {
      res.status(404).json({ error: 'Transcrição não encontrada' });
      return;
    }
    res.status(200).json(record);
  });

  router.delete('/history/:id', (req, res) => {
    const id = Number(req.params.id);
    const removed = deps.repo.remove(id);
    res.status(removed ? 204 : 404).end();
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/routes.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests across Tasks 2, 3, 5, 6, 7 passing (24 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/server/routes.ts tests/server/routes.test.ts
git commit -m "feat: add Express routes for transcription and history"
```

---

### Task 8: Server bootstrap

**Files:**
- Create: `src/server/index.ts`

**Interfaces:**
- Consumes: `createTranscriptionRepo` (Task 2), `createOpenAIClient` (Task 4), `basicAuthMiddleware` (Task 6), `createRouter` (Task 7)
- Produces: the running HTTP server (no exports consumed by other tasks).

No automated test for this task — it is wiring/bootstrap code, verified manually in Task 11.

- [ ] **Step 1: Write the implementation**

Create `src/server/index.ts`:

```ts
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranscriptionRepo } from './db.js';
import { createOpenAIClient } from './openaiClient.js';
import { basicAuthMiddleware } from './auth.js';
import { createRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

const PORT = Number(process.env.PORT ?? 3001);
const OPENAI_API_KEY = requireEnv('OPENAI_API_KEY');
const AUTH_USER = requireEnv('AUTH_USER');
const AUTH_PASSWORD = requireEnv('AUTH_PASSWORD');
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../../data/transcricoes.db');

const repo = createTranscriptionRepo(DB_PATH);
const openaiClient = createOpenAIClient(OPENAI_API_KEY);

const app = express();
app.use(basicAuthMiddleware(AUTH_USER, AUTH_PASSWORD));
app.use('/api', createRouter({ repo, transcribeChunk: openaiClient.transcribeChunk }));

const clientDist = path.join(__dirname, '../../dist/client');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Transcritor rodando na porta ${PORT}`);
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: wire up Express server bootstrap"
```

---

### Task 9: Frontend UI

**Files:**
- Create: `src/client/index.html`
- Create: `src/client/main.ts`
- Create: `src/client/style.css`

**Interfaces:**
- Consumes: `GET /api/history`, `POST /api/transcribe`, `DELETE /api/history/:id` (JSON shape `TranscriptionRecord` from Task 2, mirrored client-side).

No automated test — pure UI, verified manually in Task 11 by using it in a real browser.

- [ ] **Step 1: Create `src/client/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Transcritor</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>Transcritor</h1>

      <section id="upload-section">
        <label id="drop-zone" for="file-input">
          <span>Arraste um áudio aqui ou clique para escolher</span>
          <input id="file-input" type="file" accept="audio/*" hidden />
        </label>
        <button id="transcribe-btn" disabled>Transcrever</button>
        <p id="status"></p>
      </section>

      <section id="result-section" hidden>
        <h2>Resultado</h2>
        <textarea id="result-text" readonly></textarea>
        <div class="actions">
          <button id="copy-btn">Copiar</button>
          <button id="download-btn">Baixar .txt</button>
        </div>
      </section>

      <section id="history-section">
        <h2>Histórico</h2>
        <ul id="history-list"></ul>
      </section>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/client/main.ts`**

```ts
interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  durationSeconds: number;
  createdAt: string;
}

const dropZone = document.getElementById('drop-zone') as HTMLLabelElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const transcribeBtn = document.getElementById('transcribe-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const resultSection = document.getElementById('result-section') as HTMLElement;
const resultText = document.getElementById('result-text') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const historyList = document.getElementById('history-list') as HTMLUListElement;

let selectedFile: File | null = null;
let currentFilename = 'transcricao.txt';

function setStatus(message: string) {
  statusEl.textContent = message;
}

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] ?? null;
  transcribeBtn.disabled = !selectedFile;
  setStatus(selectedFile ? `Selecionado: ${selectedFile.name}` : '');
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    selectedFile = file;
    transcribeBtn.disabled = false;
    setStatus(`Selecionado: ${file.name}`);
  }
});

transcribeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  transcribeBtn.disabled = true;
  setStatus('Transcrevendo... isso pode levar alguns minutos para áudios longos.');

  const formData = new FormData();
  formData.append('audio', selectedFile);

  try {
    const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Erro ao transcrever');
    }
    showResult(data as TranscriptionRecord);
    await loadHistory();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Erro desconhecido');
  } finally {
    transcribeBtn.disabled = false;
  }
});

function showResult(record: TranscriptionRecord) {
  resultText.value = record.text;
  currentFilename = record.filename.replace(/\.[^.]+$/, '') + '.txt';
  resultSection.hidden = false;
  setStatus('Concluído.');
}

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  setStatus('Copiado para a área de transferência.');
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([resultText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename;
  a.click();
  URL.revokeObjectURL(url);
});

async function loadHistory() {
  const response = await fetch('/api/history');
  const records: TranscriptionRecord[] = await response.json();
  historyList.innerHTML = '';
  for (const record of records) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = `${record.filename} — ${new Date(record.createdAt).toLocaleString('pt-BR')}`;
    button.addEventListener('click', () => showResult(record));

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Excluir';
    deleteBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await fetch(`/api/history/${record.id}`, { method: 'DELETE' });
      await loadHistory();
    });

    li.append(button, deleteBtn);
    historyList.append(li);
  }
}

loadHistory();
```

- [ ] **Step 3: Create `src/client/style.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem;
}

#drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  border: 2px dashed #888;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  margin-bottom: 1rem;
}

textarea#result-text {
  width: 100%;
  height: 200px;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

#history-list {
  list-style: none;
  padding: 0;
}

#history-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #ccc;
}
```

- [ ] **Step 4: Verify the client builds**

Run: `npm run build`
Expected: Vite reports a successful build, creating `dist/client/index.html` and bundled assets.

- [ ] **Step 5: Commit**

```bash
git add src/client
git commit -m "feat: add frontend UI for upload, results and history"
```

---

### Task 10: Railway deploy configuration

**Files:**
- Create: `nixpacks.toml`
- Create: `railway.json`
- Create: `README.md`

**Interfaces:** none (deploy configuration only).

- [ ] **Step 1: Create `nixpacks.toml`**

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "ffmpeg"]

[phases.build]
cmds = ["npm ci", "npm run build"]

[start]
cmd = "npm run start"
```

- [ ] **Step 2: Create `railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks",
    "nixpacksConfigPath": "nixpacks.toml"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Transcritor

Ferramenta pessoal para transcrever áudios via OpenAI `gpt-4o-transcribe`,
com histórico salvo em SQLite. Sem contas de usuário — protegida por HTTP
Basic Auth.

## Desenvolvimento local

    cp .env.example .env
    # preencher OPENAI_API_KEY, AUTH_USER, AUTH_PASSWORD em .env
    npm install
    npm run dev

Frontend em http://localhost:5173 (proxy para a API em :3001).

## Build e execução em produção

    npm run build
    npm start

## Variáveis de ambiente

- `OPENAI_API_KEY` — chave da API da OpenAI.
- `AUTH_USER` / `AUTH_PASSWORD` — credenciais do HTTP Basic Auth.
- `DB_PATH` — caminho do arquivo SQLite (padrão: `./data/transcricoes.db`).
- `PORT` — porta HTTP (padrão: 3001; Railway define automaticamente).

## Deploy no Railway

Requer um volume persistente montado (ex: em `/data`) e `DB_PATH` apontando
para dentro dele, para que o histórico sobreviva a reinicializações. Ver
`docs/superpowers/specs/2026-08-01-transcritor-design.md` para o design
completo.
```

- [ ] **Step 4: Commit**

```bash
git add nixpacks.toml railway.json README.md
git commit -m "chore: add Railway deploy configuration"
```

---

### Task 11: Manual end-to-end verification (local)

**Files:** none created — this task exercises the app built in Tasks 1–10.

- [ ] **Step 1: Set up local environment**

Run: `cd /home/gustavolendimuth/projetos/transcritor && cp .env.example .env`

Edit `.env` and fill in:
- `OPENAI_API_KEY` — copy from `/home/gustavolendimuth/openAiApiKey.txt`
- `AUTH_USER` — pick any username, e.g. `gustavo`
- `AUTH_PASSWORD` — pick a real password (this will also be used in Task 12 for the deployed app)

- [ ] **Step 2: Run the full automated test suite one more time**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 3: Start the app in dev mode**

Run: `npm run dev`
Expected: server logs `Transcritor rodando na porta 3001`, Vite logs a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 4: Verify Basic Auth is enforced**

Open `http://localhost:5173` in a browser. Expected: the browser shows a native username/password prompt before the page loads. Cancelling it should show an unauthorized page; entering the credentials from `.env` should load the app.

- [ ] **Step 5: Verify a short audio file**

Upload one of `/home/gustavolendimuth/Downloads/WhatsApp Ptt 2026-07-31 at 22.37.10.ogg` (small file). Expected: transcription completes without the compress/split path, result text appears, "Copiar" and "Baixar .txt" both work.

- [ ] **Step 6: Verify a long/large audio file**

Upload `/home/gustavolendimuth/Downloads/1 de ago. 11.43_.m4a` (37MB, ~19min). Expected: takes longer (multiple chunk calls to OpenAI), full transcription appears without being cut off mid-sentence, matching the quality of the manual transcription done earlier in this conversation.

- [ ] **Step 7: Verify history persistence**

Reload the page. Expected: both transcriptions appear in the history list, most recent first. Stop the dev server (`Ctrl+C`) and restart `npm run dev`. Expected: history is still there (confirms SQLite persistence to `./data/transcricoes.db`).

- [ ] **Step 8: Verify delete**

Click "Excluir" on one history item. Expected: it disappears from the list and does not come back after a page reload.

- [ ] **Step 9: Report results**

If any step fails, fix the underlying code (not this task) and re-run from Step 3. Do not proceed to Task 12 until all steps above pass.

---

### Task 12: Deploy to Railway

**Files:** none — infrastructure operation.

This task creates and configures real, billed cloud resources. Confirm with the user before creating the Railway project/service if this hasn't been explicitly authorized yet.

- [ ] **Step 1: Invoke the Railway skill**

Use the `use-railway` skill to:
1. Create a new Railway project (e.g. named `transcritor`) with one service pointing at `/home/gustavolendimuth/projetos/transcritor`.
2. Attach a persistent volume to the service, mounted at `/data`.
3. Set service variables:
   - `OPENAI_API_KEY` = (value from `/home/gustavolendimuth/openAiApiKey.txt`)
   - `AUTH_USER` = the same value used in local `.env` (Task 11)
   - `AUTH_PASSWORD` = the same value used in local `.env` (Task 11)
   - `DB_PATH` = `/data/transcricoes.db`
4. Deploy the service (build should pick up `nixpacks.toml`, installing `ffmpeg` alongside Node).
5. Generate a public domain for the service.

- [ ] **Step 2: Verify the deployed build succeeded**

Check the Railway deployment logs. Expected: build phase installs `ffmpeg` and runs `npm ci && npm run build` without errors; the app logs `Transcritor rodando na porta <PORT>` on start.

- [ ] **Step 3: Smoke test the live URL**

Open the generated Railway domain in a browser. Expected: HTTP Basic Auth prompt appears; after entering credentials, upload the same short audio file from Task 11, Step 5, and confirm a successful transcription end-to-end against the live deployment.

- [ ] **Step 4: Confirm persistence across redeploys**

Trigger a redeploy (or restart) from Railway and reload the app. Expected: the history from Step 3 is still present, confirming the volume-backed SQLite database persists correctly.
