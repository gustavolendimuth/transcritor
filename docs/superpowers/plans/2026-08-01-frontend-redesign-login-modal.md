# Frontend Redesign + Login Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bare-bones frontend and native HTTP Basic Auth prompt with a polished Catppuccin Mocha UI and a custom login modal, without changing any backend code.

**Architecture:** Pure client-side change. `src/client/auth.ts` (new) owns credential storage (`sessionStorage`) and an `authFetch()` wrapper that injects the `Authorization: Basic` header and reacts to `401`s. `src/client/main.ts` drives a login-modal-or-app-content bootstrap flow and wires all existing upload/result/history logic through `authFetch`. `src/client/index.html` and `src/client/style.css` are rewritten for the new markup and design system. `src/server/*` is untouched.

**Tech Stack:** Vite, vanilla TypeScript, plain CSS (no framework), Google Fonts (Fraunces, IBM Plex Sans, IBM Plex Mono).

## Global Constraints

- No backend files change (`src/server/**`, `tests/server/**` stay as-is).
- Auth stays HTTP Basic Auth server-side; the modal only changes how the client collects/sends credentials.
- `sessionStorage`, not `localStorage`, for the encoded credentials.
- Color tokens: Catppuccin Mocha — base `#1e1e2e`, mantle `#181825`, surface0 `#313244`, surface1 `#45475a`, surface2 `#585b70`, overlay0 `#6c7086`, text `#cdd6f4`, subtext0 `#a6adc8`, subtext1 `#bac2de`, mauve `#cba6f7`, green `#a6e3a1`, red `#f38ba8`, yellow `#f9e2af`.
- Type roles: Fraunces (display/headings only), IBM Plex Sans (UI/body), IBM Plex Mono (transcript textarea + history metadata).
- Signature element: CSS-only "waveform" bars mark, reused for the header brand mark and the Transcribe button's loading state. Must respect `prefers-reduced-motion`.
- No automated frontend tests exist in this repo and none are being added (matches `docs/superpowers/specs/2026-08-01-frontend-redesign-login-modal-design.md`). Verification is `npm run typecheck`, `npm run build`, and manual/Playwright checks in the browser.

---

### Task 1: `src/client/auth.ts` — credential storage + authFetch

**Files:**
- Create: `src/client/auth.ts`

**Interfaces:**
- Produces: `getCredentials(): string | null`, `attemptLogin(user: string, password: string): Promise<boolean>`, `clearCredentials(): void`, `authFetch(input: RequestInfo, init?: RequestInit): Promise<Response>`. Dispatches a `window` `CustomEvent('auth:unauthorized')` whenever a request comes back `401`.
- Consumes: nothing (leaf module).

- [ ] **Step 1: Write the file**

```typescript
const STORAGE_KEY = 'transcritor:credentials';

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function getCredentials(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function attemptLogin(user: string, password: string): Promise<boolean> {
  const encoded = toBase64(`${user}:${password}`);
  const response = await fetch('/api/history', {
    headers: { Authorization: `Basic ${encoded}` },
  });
  if (response.ok) {
    sessionStorage.setItem(STORAGE_KEY, encoded);
    return true;
  }
  return false;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const credentials = getCredentials();
  const headers = new Headers(init.headers);
  if (credentials) {
    headers.set('Authorization', `Basic ${credentials}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearCredentials();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  return response;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors (this file has no consumers yet, so it just needs to compile standalone).

- [ ] **Step 3: Commit**

```bash
git add src/client/auth.ts
git commit -m "feat: add client-side Basic Auth credential store and authFetch"
```

---

### Task 2: `src/client/index.html` — new markup + fonts

**Files:**
- Modify: `src/client/index.html` (full replace)

**Interfaces:**
- Produces: DOM element IDs consumed by Task 4 (`main.ts`): `login-backdrop`, `login-form`, `login-user`, `login-password`, `login-error`, `app`, `logout-btn`, `drop-zone`, `file-input`, `transcribe-btn`, `status`, `result-section`, `result-text`, `copy-btn`, `download-btn`, `history-section`, `history-empty`, `history-list`.
- Consumes: `./style.css`, `./main.ts` (unchanged paths).

- [ ] **Step 1: Replace the file**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Transcritor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
    />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <div id="login-backdrop" class="backdrop" hidden>
      <form id="login-form" class="modal" novalidate>
        <div class="waveform" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <h1 class="modal-title">Transcritor</h1>
        <p class="modal-subtitle">Entre para continuar</p>
        <label class="field">
          <span>Usuário</span>
          <input id="login-user" type="text" autocomplete="username" required />
        </label>
        <label class="field">
          <span>Senha</span>
          <input id="login-password" type="password" autocomplete="current-password" required />
        </label>
        <p id="login-error" class="error" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary">Entrar</button>
      </form>
    </div>

    <div id="app" hidden>
      <header class="app-header">
        <div class="brand">
          <div class="waveform" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <h1>Transcritor</h1>
        </div>
        <button id="logout-btn" type="button" class="btn btn-ghost">Sair</button>
      </header>

      <main>
        <section id="upload-section" class="card">
          <label id="drop-zone" for="file-input" class="dropzone">
            <svg
              class="dropzone-icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke-linecap="round" stroke-linejoin="round" />
              <path
                d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>Arraste um áudio aqui ou clique para escolher</span>
            <input id="file-input" type="file" accept="audio/*" hidden />
          </label>
          <button id="transcribe-btn" type="button" class="btn btn-primary" disabled>
            <span class="btn-label">Transcrever</span>
            <span class="waveform waveform-btn" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </span>
          </button>
          <p id="status" class="status"></p>
        </section>

        <section id="result-section" class="card" hidden>
          <h2>Resultado</h2>
          <textarea id="result-text" class="result-text" readonly></textarea>
          <div class="actions">
            <button id="copy-btn" type="button" class="btn btn-secondary">Copiar</button>
            <button id="download-btn" type="button" class="btn btn-secondary">Baixar .txt</button>
          </div>
        </section>

        <section id="history-section" class="card">
          <h2>Histórico</h2>
          <p id="history-empty" class="empty-state" hidden>
            Nenhuma transcrição ainda — envie um áudio acima para começar.
          </p>
          <ul id="history-list"></ul>
        </section>
      </main>
    </div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/client/index.html
git commit -m "feat: restructure markup for login modal and redesigned layout"
```

(No isolated typecheck/build for this step — Task 4 wires the new IDs into `main.ts`; the combined build is verified at the end of Task 4.)

---

### Task 3: `src/client/style.css` — Catppuccin Mocha design system

**Files:**
- Modify: `src/client/style.css` (full replace)

**Interfaces:**
- Consumes: class/ID hooks produced by Task 2's HTML.
- Produces: nothing consumed by TypeScript; `main.ts` (Task 4) toggles the classes `is-dragover` (on `#drop-zone`) and `is-loading` (on `#transcribe-btn`) that this file defines styles for.

- [ ] **Step 1: Replace the file**

```css
:root {
  color-scheme: dark;

  --ctp-base: #1e1e2e;
  --ctp-mantle: #181825;
  --ctp-surface0: #313244;
  --ctp-surface1: #45475a;
  --ctp-surface2: #585b70;
  --ctp-overlay0: #6c7086;
  --ctp-text: #cdd6f4;
  --ctp-subtext0: #a6adc8;
  --ctp-subtext1: #bac2de;
  --ctp-mauve: #cba6f7;
  --ctp-mauve-dim: #b592e8;
  --ctp-green: #a6e3a1;
  --ctp-red: #f38ba8;
  --ctp-yellow: #f9e2af;

  --font-display: 'Fraunces', ui-serif, serif;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;

  --radius: 12px;
  --radius-sm: 8px;
  --space-1: 0.5rem;
  --space-2: 0.75rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;

  --shadow-card: 0 1px 2px rgba(17, 17, 27, 0.4), 0 8px 24px rgba(17, 17, 27, 0.35);
  --shadow-modal: 0 24px 60px rgba(17, 17, 27, 0.6);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--ctp-base);
  color: var(--ctp-text);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
}

h1,
h2 {
  font-family: var(--font-display);
  font-weight: 600;
  margin: 0;
}

button,
input {
  font-family: inherit;
  color: inherit;
}

#app {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-3) var(--space-6);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0 var(--space-5);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.brand h1 {
  font-size: 1.5rem;
  letter-spacing: -0.01em;
}

.waveform {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
}

.waveform span {
  width: 3px;
  border-radius: 2px;
  background: var(--ctp-mauve);
  animation: waveform-pulse 1.2s ease-in-out infinite;
}

.waveform span:nth-child(1) {
  height: 40%;
  animation-delay: -1.1s;
}
.waveform span:nth-child(2) {
  height: 80%;
  animation-delay: -0.9s;
}
.waveform span:nth-child(3) {
  height: 100%;
  animation-delay: -0.7s;
}
.waveform span:nth-child(4) {
  height: 60%;
  animation-delay: -0.5s;
}
.waveform span:nth-child(5) {
  height: 30%;
  animation-delay: -0.3s;
}

@keyframes waveform-pulse {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

.waveform-btn {
  display: none;
  height: 16px;
}

.btn.is-loading .btn-label {
  display: none;
}

.btn.is-loading .waveform-btn {
  display: inline-flex;
}

.btn.is-loading .waveform-btn span {
  background: var(--ctp-base);
}

.card {
  background: var(--ctp-surface0);
  border: 1px solid var(--ctp-surface1);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.card h2 {
  font-size: 1.125rem;
  margin-bottom: var(--space-3);
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 140px;
  border: 2px dashed var(--ctp-surface2);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: center;
  color: var(--ctp-subtext0);
  padding: var(--space-4);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
  margin-bottom: var(--space-3);
}

.dropzone-icon {
  color: var(--ctp-overlay0);
  transition: color 0.15s ease;
}

.dropzone:hover,
.dropzone.is-dragover {
  border-color: var(--ctp-mauve);
  border-style: solid;
  background: rgba(203, 166, 247, 0.06);
  color: var(--ctp-text);
}

.dropzone:hover .dropzone-icon,
.dropzone.is-dragover .dropzone-icon {
  color: var(--ctp-mauve);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.btn:focus-visible {
  outline: 2px solid var(--ctp-mauve);
  outline-offset: 2px;
}

.btn-primary {
  background: var(--ctp-mauve);
  color: var(--ctp-mantle);
}

.btn-primary:hover:not(:disabled) {
  background: var(--ctp-mauve-dim);
}

.btn-primary:disabled {
  background: var(--ctp-surface2);
  color: var(--ctp-overlay0);
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--ctp-surface1);
  color: var(--ctp-text);
}

.btn-secondary:hover {
  background: var(--ctp-surface2);
}

.btn-ghost {
  background: transparent;
  color: var(--ctp-subtext0);
  border: 1px solid var(--ctp-surface1);
}

.btn-ghost:hover {
  color: var(--ctp-text);
  border-color: var(--ctp-surface2);
}

.status {
  min-height: 1.25em;
  color: var(--ctp-subtext0);
  font-size: 0.875rem;
  margin: var(--space-2) 0 0;
}

.result-text {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  background: var(--ctp-mantle);
  color: var(--ctp-text);
  border: 1px solid var(--ctp-surface1);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  line-height: 1.6;
}

.result-text:focus-visible {
  outline: 2px solid var(--ctp-mauve);
  outline-offset: 2px;
}

.actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.empty-state {
  color: var(--ctp-subtext0);
  font-size: 0.9375rem;
  margin: 0;
}

#history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-bottom: 1px solid var(--ctp-surface1);
}

.history-item:last-child {
  border-bottom: none;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  background: none;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  text-align: left;
}

.history-filename {
  color: var(--ctp-text);
  font-size: 0.9375rem;
}

.history-meta {
  color: var(--ctp-subtext0);
  font-size: 0.8125rem;
  font-family: var(--font-mono);
}

.history-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--ctp-overlay0);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.history-item:hover .history-delete,
.history-delete:focus-visible {
  opacity: 1;
}

.history-delete:hover {
  background: rgba(243, 139, 168, 0.12);
  color: var(--ctp-red);
}

.backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 27, 0.72);
  backdrop-filter: blur(6px);
  padding: var(--space-3);
  z-index: 10;
}

.modal {
  width: 100%;
  max-width: 360px;
  background: var(--ctp-surface0);
  border: 1px solid var(--ctp-surface1);
  border-radius: var(--radius);
  box-shadow: var(--shadow-modal);
  padding: var(--space-5) var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-1);
}

.modal-title {
  font-size: 1.5rem;
  margin-top: var(--space-2);
}

.modal-subtitle {
  color: var(--ctp-subtext0);
  margin: 0 0 var(--space-3);
  font-size: 0.9375rem;
}

.field {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  margin-bottom: var(--space-3);
  font-size: 0.875rem;
  color: var(--ctp-subtext1);
}

.field input {
  width: 100%;
  background: var(--ctp-mantle);
  border: 1px solid var(--ctp-surface1);
  border-radius: var(--radius-sm);
  padding: 0.625rem 0.75rem;
  font-size: 0.9375rem;
}

.field input:focus-visible {
  outline: 2px solid var(--ctp-mauve);
  outline-offset: 1px;
}

.error {
  width: 100%;
  color: var(--ctp-red);
  font-size: 0.875rem;
  margin: 0 0 var(--space-3);
}

.modal .btn-primary {
  width: 100%;
}

@media (max-width: 480px) {
  #app {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }

  .card {
    padding: var(--space-3);
  }

  .actions {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waveform span {
    animation: none;
    transform: scaleY(0.7);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/style.css
git commit -m "feat: add Catppuccin Mocha design system styles"
```

---

### Task 4: `src/client/main.ts` — wire auth flow into existing app logic

**Files:**
- Modify: `src/client/main.ts` (full replace)

**Interfaces:**
- Consumes: `getCredentials`, `attemptLogin`, `clearCredentials`, `authFetch` from `./auth.js` (Task 1); DOM IDs from Task 2's HTML.
- Produces: nothing consumed elsewhere (top-level bootstrap).

- [ ] **Step 1: Replace the file**

```typescript
import { attemptLogin, authFetch, clearCredentials, getCredentials } from './auth.js';

interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  durationSeconds: number;
  createdAt: string;
}

const loginBackdrop = document.getElementById('login-backdrop') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginUser = document.getElementById('login-user') as HTMLInputElement;
const loginPassword = document.getElementById('login-password') as HTMLInputElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;

const appRoot = document.getElementById('app') as HTMLDivElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

const dropZone = document.getElementById('drop-zone') as HTMLLabelElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const transcribeBtn = document.getElementById('transcribe-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;
const resultSection = document.getElementById('result-section') as HTMLElement;
const resultText = document.getElementById('result-text') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const historyList = document.getElementById('history-list') as HTMLUListElement;
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;

let selectedFile: File | null = null;
let currentFilename = 'transcricao.txt';

function setStatus(message: string) {
  statusEl.textContent = message;
}

function showApp() {
  loginBackdrop.hidden = true;
  appRoot.hidden = false;
}

function showLogin() {
  appRoot.hidden = true;
  loginBackdrop.hidden = false;
  loginUser.focus();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const user = loginUser.value.trim();
  const password = loginPassword.value;
  const ok = await attemptLogin(user, password);
  if (!ok) {
    loginError.textContent = 'Usuário ou senha inválidos.';
    loginError.hidden = false;
    loginPassword.value = '';
    loginUser.focus();
    return;
  }
  loginForm.reset();
  showApp();
  await loadHistory();
});

logoutBtn.addEventListener('click', () => {
  clearCredentials();
  showLogin();
});

window.addEventListener('auth:unauthorized', () => {
  showLogin();
});

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] ?? null;
  transcribeBtn.disabled = !selectedFile;
  setStatus(selectedFile ? `Selecionado: ${selectedFile.name}` : '');
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('is-dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('is-dragover');
});

dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragover');
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
  transcribeBtn.classList.add('is-loading');
  setStatus('Transcrevendo... isso pode levar alguns minutos para áudios longos.');

  const formData = new FormData();
  formData.append('audio', selectedFile);

  try {
    const response = await authFetch('/api/transcribe', { method: 'POST', body: formData });
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
    transcribeBtn.classList.remove('is-loading');
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

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function loadHistory() {
  try {
    const response = await authFetch('/api/history');
    if (!response.ok) {
      throw new Error('Não foi possível carregar o histórico');
    }
    const records: TranscriptionRecord[] = await response.json();
    historyList.innerHTML = '';
    historyEmpty.hidden = records.length > 0;
    for (const record of records) {
      const li = document.createElement('li');
      li.className = 'history-item';

      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'history-info';
      const duration = formatDuration(record.durationSeconds);
      info.innerHTML = `<span class="history-filename">${escapeHtml(record.filename)}</span><span class="history-meta">${duration} · ${new Date(record.createdAt).toLocaleString('pt-BR')}</span>`;
      info.addEventListener('click', () => showResult(record));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete';
      deleteBtn.setAttribute('aria-label', `Excluir ${record.filename}`);
      deleteBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const deleteResponse = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          setStatus('Não foi possível excluir a transcrição.');
          return;
        }
        await loadHistory();
      });

      li.append(info, deleteBtn);
      historyList.append(li);
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Erro ao carregar histórico');
  }
}

async function bootstrap() {
  if (getCredentials()) {
    const response = await authFetch('/api/history');
    if (response.ok) {
      showApp();
      await loadHistory();
      return;
    }
  }
  showLogin();
}

bootstrap();
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Vite build succeeds, `dist/client/` produced with no errors or warnings about missing modules.

- [ ] **Step 4: Commit**

```bash
git add src/client/main.ts
git commit -m "feat: wire login modal, logout, and authFetch into app bootstrap"
```

---

### Task 5: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server on `:3001` (or `PORT`), Vite client dev server prints a local URL.

- [ ] **Step 2: Manual checks**

Open the client dev URL and confirm, in order:
1. Login modal appears immediately; app content is not visible/interactable behind it.
2. Wrong username/password → inline red error message, modal stays open, password field clears.
3. Correct credentials (from `.env`: `AUTH_USER`/`AUTH_PASSWORD`) → modal closes, header + upload/history UI appear, history loads (or shows the new empty state if there's no history yet).
4. Reload the page → modal does **not** reappear (session credentials persisted via `sessionStorage`) and history loads automatically.
5. Upload an audio file → drag-and-drop and click-to-browse both work; Transcribe button shows the waveform loading state while disabled; result card appears with monospace transcript text on completion.
6. Copy and download buttons work on the result.
7. History list shows the new item; clicking an item reloads it into the result card; delete button (hover-revealed trash icon) removes it and the empty state reappears once the list is empty.
8. Click "Sair" → modal reopens, app content hides.
9. Resize to a narrow (~375px) viewport → layout stays usable, no horizontal scroll, modal fits with margin.

- [ ] **Step 3: Playwright screenshot pass (self-critique)**

Use the Playwright MCP tools to navigate to the local dev URL, log in through the modal (fill `#login-user`/`#login-password`, click the submit button — do not embed credentials in the URL this time, since that broke `fetch` last time), and take a full-page screenshot. Compare against the design intent (Catppuccin Mocha, Fraunces wordmark, waveform mark, card layout) and fix any visual bugs found before moving on.

---

### Task 6: Deploy to Railway

**Files:** none (deployment only).

- [ ] **Step 1: Confirm working tree is clean and on the intended commits**

Run: `git status` and `git log --oneline -6`
Expected: working tree clean, top commits are Tasks 1–4's commits.

- [ ] **Step 2: Deploy**

Run (reuse the already-linked Railway project/service/environment IDs from the prior deploy):

```bash
RAILWAY_CALLER="skill:use-railway@1.3.6" RAILWAY_AGENT_SESSION="railway-skill-deploy-$(date +%s)-$$" railway up --detach -m "feat: redesign frontend with Catppuccin Mocha theme and login modal" \
  --service 0f27214f-a750-4e83-94ab-aa10d4e3fa86 \
  --environment fb4f8e90-64dd-405d-a9af-869be93717a7 \
  --project 3708a708-1bda-4015-9677-1425c98274ea
```

- [ ] **Step 3: Poll until terminal status**

Run: `railway deployment list --json --service 0f27214f-a750-4e83-94ab-aa10d4e3fa86 --environment fb4f8e90-64dd-405d-a9af-869be93717a7 --project 3708a708-1bda-4015-9677-1425c98274ea`
Expected: the new deployment's `status` reaches `SUCCESS` (poll every ~8s; do not report success on `INITIALIZING`/`BUILDING`/empty).

- [ ] **Step 4: Verify in production with Playwright**

Navigate to `https://transcritor.gustavolendimuth.uk/`, confirm the login modal renders (Catppuccin Mocha, waveform mark, Fraunces wordmark), log in through the form fields (not URL-embedded credentials), and screenshot the authenticated app view.

---
