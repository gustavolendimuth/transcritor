# Dropzone File State + Alert Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the selected file's name inside the dropzone (still clickable to swap files), remove the status line below the "Transcrever" button, and route all warnings/success messages through a shared alert modal like the existing loading modal.

**Architecture:** Two independent, sequentially-applied UI changes to the same three client files (`index.html`, `style.css`, `main.ts`). Task 1 adds a `has-file` visual state to the dropzone driven by a new `setSelectedFile` helper. Task 2 adds an `#alert-backdrop` modal (same structural pattern as `#loading-backdrop`) driven by a new `showAlert(message, type)` helper, and removes the old `<p id="status">` line and `setStatus` function entirely, rewiring every call site that used it.

**Tech Stack:** TypeScript (no framework, plain DOM APIs), Vite dev server, vanilla CSS with CSS custom properties (Catppuccin Mocha theme tokens already defined in `:root`).

## Global Constraints

- No client-side automated test suite exists in this repo (`tests/` only covers `src/server`) — verification for both tasks is `npm run typecheck` plus manual browser checks, as documented in the design spec's "Testes" section.
- Login credentials for manual verification come from the local `.env` file (`AUTH_USER` / `AUTH_PASSWORD`) — never hardcode or print the actual secret value in code, commits, or this plan.
- Modal close behavior: alert modal closes only via its "OK" button — no backdrop-click-to-close, no auto-hide (per design spec decision).
- Colors must reuse existing theme tokens: `--ctp-green` for success, `--ctp-red` for error — no new color values introduced.
- Loading modal and alert modal must never be visible at the same time.

---

### Task 1: Dropzone shows the selected file, stays clickable to swap

**Files:**
- Modify: `src/client/index.html:49-69` (the `#drop-zone` label block)
- Modify: `src/client/style.css` (insert new rules after the existing `.dropzone-icon` / `.dropzone:hover` block, i.e. after line 199)
- Modify: `src/client/main.ts:44-45` (add helper after `selectedFile`/`currentFilename` declarations), `main.ts:89-93` (file input `change` handler), `main.ts:104-113` (drop handler)
- Test: none automated — manual browser verification (no client test suite in this repo)

**Interfaces:**
- Produces: `setSelectedFile(file: File | null): void` — sets `selectedFile`, toggles `transcribeBtn.disabled`, toggles the `has-file` class on `#drop-zone`, and writes the filename into `#dropzone-filename`. Later tasks (and the rest of this task) must call this instead of assigning `selectedFile` directly.
- Produces: DOM id `dropzone-filename` (new `<span>` inside the dropzone) and CSS class `has-file` (toggled on `#drop-zone`).

- [ ] **Step 1: Update the dropzone markup in `index.html`**

Replace the existing block (lines 49-69):

```html
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
```

with:

```html
          <label id="drop-zone" for="file-input" class="dropzone">
            <svg
              class="dropzone-icon dropzone-icon-upload"
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
            <svg
              class="dropzone-icon dropzone-icon-check"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="dropzone-prompt">Arraste um áudio aqui ou clique para escolher</span>
            <span class="dropzone-file">
              <span id="dropzone-filename" class="dropzone-filename"></span>
              <small>Clique para trocar o arquivo</small>
            </span>
            <input id="file-input" type="file" accept="audio/*" hidden />
          </label>
```

- [ ] **Step 2: Add the two-state CSS rules in `style.css`**

Right after the existing block that ends with (around line 199):

```css
.dropzone:hover .dropzone-icon,
.dropzone.is-dragover .dropzone-icon {
  color: var(--ctp-mauve);
}
```

insert:

```css

.dropzone-icon-check,
.dropzone-file {
  display: none;
}

.dropzone.has-file .dropzone-icon-upload,
.dropzone.has-file .dropzone-prompt {
  display: none;
}

.dropzone.has-file .dropzone-icon-check {
  display: block;
  color: var(--ctp-green);
}

.dropzone.has-file .dropzone-file {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.dropzone-filename {
  color: var(--ctp-text);
  font-size: 0.9375rem;
  word-break: break-all;
}

.dropzone-file small {
  color: var(--ctp-subtext0);
  font-size: 0.8125rem;
}
```

- [ ] **Step 3: Add `setSelectedFile` and the `dropzoneFilename` element reference in `main.ts`**

Right after the `fileInput`/`dropZone` element consts (near line 23), add:

```typescript
const dropzoneFilename = document.getElementById('dropzone-filename') as HTMLSpanElement;
```

Right after the existing declarations (line 44-45):

```typescript
let selectedFile: File | null = null;
let currentFilename = 'transcricao.txt';
```

add:

```typescript
function setSelectedFile(file: File | null) {
  selectedFile = file;
  transcribeBtn.disabled = !file;
  dropZone.classList.toggle('has-file', Boolean(file));
  dropzoneFilename.textContent = file ? file.name : '';
}
```

- [ ] **Step 4: Route the `change` and `drop` handlers through `setSelectedFile`**

Replace (lines 89-93):

```typescript
fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files?.[0] ?? null;
  transcribeBtn.disabled = !selectedFile;
  setStatus(selectedFile ? `Selecionado: ${selectedFile.name}` : '');
});
```

with:

```typescript
fileInput.addEventListener('change', () => {
  setSelectedFile(fileInput.files?.[0] ?? null);
});
```

Replace (lines 104-113):

```typescript
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
```

with:

```typescript
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragover');
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    setSelectedFile(file);
  }
});
```

`setStatus` and `statusEl` still exist at this point (removed in Task 2) — leave them as-is, other call sites still use them.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev` (starts both server and Vite client)
- Open the printed client URL, log in with the credentials from your local `.env` (`AUTH_USER` / `AUTH_PASSWORD`).
- Click the dropzone, pick an audio file → dropzone switches to the check icon, shows the file name, and "Clique para trocar o arquivo"; the "Transcrever" button becomes enabled.
- Click the dropzone again and pick a different file → the name updates to the new file.
- Drag an audio file onto the dropzone → same check-icon state with the dropped file's name.
- Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 7: Commit**

```bash
git add src/client/index.html src/client/style.css src/client/main.ts
git commit -m "feat: show selected file name in the dropzone"
```

---

### Task 2: Alert modal replaces the status line for warnings and success

**Files:**
- Modify: `src/client/index.html` — remove the `<p id="status">` line inside `#upload-section` (right after the `#transcribe-btn` button), and insert a new `#alert-backdrop` block right after the existing `#loading-backdrop` block, before the `<script>` tag
- Modify: `src/client/style.css` — remove the `.status` rule, and insert new `.alert-modal` / `.alert-message` rules near the existing `.loading-modal` / `.loading-message` rules
- Modify: `src/client/main.ts` — remove `statusEl` const and `setStatus` function; add `alertBackdrop`/`alertMessage`/`alertOkBtn` consts and `showAlert`; rewire `transcribeBtn` click handler, `showResult`, `loadHistory` catch, and the history delete handler
- Test: none automated — manual browser verification (no client test suite in this repo)

> Note: this task runs after Task 1, which already inserted lines into all three files. Line numbers below are from the pre-Task-1 file and will have drifted — locate each block by its literal code content (shown in full in every step), not by line number.

**Interfaces:**
- Consumes: `setSelectedFile` and `.has-file` from Task 1 are unaffected by this task (different code regions of the same files).
- Produces: `showAlert(message: string, type: 'error' | 'success'): void` — sets `#alert-message` text, toggles `alert-message--error`/`alert-message--success`, and shows `#alert-backdrop`. This is the only way any code in `main.ts` surfaces a warning or success message from here on.

- [ ] **Step 1: Remove the status paragraph and add the alert modal markup in `index.html`**

Remove line 93:

```html
          <p id="status" class="status"></p>
```

(the `#upload-section` block's closing `</section>` on line 94 stays; the button block just ends right before it now.)

After the existing `#loading-backdrop` block (ends at line 122):

```html
    <div id="loading-backdrop" class="backdrop" hidden>
      <div class="modal loading-modal" role="status" aria-live="polite">
        <span class="spinner spinner-lg" aria-hidden="true"></span>
        <p class="loading-message">
          Transcrevendo... isso pode levar alguns minutos para áudios longos.
        </p>
      </div>
    </div>
```

insert:

```html
    <div id="alert-backdrop" class="backdrop" hidden>
      <div class="modal alert-modal" role="alertdialog" aria-live="assertive">
        <p id="alert-message" class="alert-message"></p>
        <button id="alert-ok-btn" type="button" class="btn btn-primary">OK</button>
      </div>
    </div>
```

- [ ] **Step 2: Update `style.css`**

Remove the `.status` rule (lines 258-263):

```css
.status {
  min-height: 1.25em;
  color: var(--ctp-subtext0);
  font-size: 0.875rem;
  margin: var(--space-2) 0 0;
}
```

After the existing block (around line 289):

```css
.loading-message {
  margin: 0;
  color: var(--ctp-subtext1);
  font-size: 0.9375rem;
}
```

insert:

```css

.alert-modal {
  gap: var(--space-3);
}

.alert-message {
  margin: 0;
  font-size: 0.9375rem;
}

.alert-message--error {
  color: var(--ctp-red);
}

.alert-message--success {
  color: var(--ctp-green);
}
```

- [ ] **Step 3: Remove `statusEl`/`setStatus` and add the alert modal wiring in `main.ts`**

Remove the `statusEl` const (line 25):

```typescript
const statusEl = document.getElementById('status') as HTMLParagraphElement;
```

Right after it, add the three new element consts:

```typescript
const alertBackdrop = document.getElementById('alert-backdrop') as HTMLDivElement;
const alertMessage = document.getElementById('alert-message') as HTMLParagraphElement;
const alertOkBtn = document.getElementById('alert-ok-btn') as HTMLButtonElement;
```

Remove the `setStatus` function (lines 47-49):

```typescript
function setStatus(message: string) {
  statusEl.textContent = message;
}
```

In its place, add:

```typescript
function showAlert(message: string, type: 'error' | 'success') {
  alertMessage.textContent = message;
  alertMessage.classList.toggle('alert-message--error', type === 'error');
  alertMessage.classList.toggle('alert-message--success', type === 'success');
  alertBackdrop.hidden = false;
}

alertOkBtn.addEventListener('click', () => {
  alertBackdrop.hidden = true;
});
```

- [ ] **Step 4: Rewire the transcribe click handler**

Replace the full handler:

```typescript
transcribeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  transcribeBtn.disabled = true;
  transcribeBtn.classList.add('is-loading');
  loadingBackdrop.hidden = false;

  const formData = new FormData();
  formData.append('audio', selectedFile);
  formData.append('withTimestamps', String(timestampsCheckbox.checked));
  formData.append('language', languageSelect.value);

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
    loadingBackdrop.hidden = true;
  }
});
```

with:

```typescript
transcribeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  transcribeBtn.disabled = true;
  transcribeBtn.classList.add('is-loading');
  loadingBackdrop.hidden = false;

  const formData = new FormData();
  formData.append('audio', selectedFile);
  formData.append('withTimestamps', String(timestampsCheckbox.checked));
  formData.append('language', languageSelect.value);

  try {
    const response = await authFetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? 'Erro ao transcrever');
    }
    loadingBackdrop.hidden = true;
    showResult(data as TranscriptionRecord);
    await loadHistory();
    showAlert('Concluído.', 'success');
  } catch (error) {
    loadingBackdrop.hidden = true;
    showAlert(error instanceof Error ? error.message : 'Erro desconhecido', 'error');
  } finally {
    transcribeBtn.disabled = false;
    transcribeBtn.classList.remove('is-loading');
  }
});
```

- [ ] **Step 5: Stop `showResult` from touching status**

Replace:

```typescript
function showResult(record: TranscriptionRecord) {
  resultText.value = record.text;
  currentFilename = record.filename.replace(/\.[^.]+$/, '') + '.txt';
  resultSection.hidden = false;
  setStatus('Concluído.');
}
```

with:

```typescript
function showResult(record: TranscriptionRecord) {
  resultText.value = record.text;
  currentFilename = record.filename.replace(/\.[^.]+$/, '') + '.txt';
  resultSection.hidden = false;
}
```

(The "Concluído." success alert is now triggered only from the transcribe click handler's success path added in Step 4 — not from `showResult`, since `showResult` is also called when opening an old item from history, where a "Concluído." popup would be unwanted.)

- [ ] **Step 6: Rewire `loadHistory`'s error path**

Replace:

```typescript
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Erro ao carregar histórico');
  }
```

with:

```typescript
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Erro ao carregar histórico', 'error');
  }
```

(this is inside `loadHistory`, not the copy/download handlers — the only `catch` block in that function.)

- [ ] **Step 7: Rewire the history delete handler**

Replace:

```typescript
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const deleteResponse = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          setStatus('Não foi possível excluir a transcrição.');
          return;
        }
        await loadHistory();
      });
```

with:

```typescript
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const deleteResponse = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          showAlert('Não foi possível excluir a transcrição.', 'error');
          return;
        }
        await loadHistory();
      });
```

- [ ] **Step 8: Also update the copy-to-clipboard status message**

The copy button's handler used `setStatus` for feedback:

```typescript
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  setStatus('Copiado para a área de transferência.');
});
```

Replace with:

```typescript
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  showAlert('Copiado para a área de transferência.', 'success');
});
```

- [ ] **Step 9: Grep for any remaining `setStatus`/`statusEl` references**

Run: `grep -n "setStatus\|statusEl" src/client/main.ts`
Expected: no output (all call sites converted in Steps 4-8, declarations removed in Step 3).

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 11: Manual verification in the browser**

Run: `npm run dev`
- Log in, select a file (dropzone shows its name from Task 1), click "Transcrever" with a real short audio file → loading modal appears, then disappears, the result section shows the text, and the alert modal opens with "Concluído." in green; clicking "OK" closes it.
- Click "Copiar" on a result → alert modal opens in green with "Copiado para a área de transferência."; close it.
- Stop the server, restart only `npm run dev:client` pointing at a dead backend (or temporarily rename `.env`'s `OPENAI_API_KEY` to force a 502) and try transcribing → alert modal opens in red with the error message; "OK" closes it. Restore `.env` afterward.
- Click a history item's delete button and confirm any induced failure (e.g. stop the server mid-click) surfaces the red alert modal; a normal successful delete just refreshes the list with no modal.
- Confirm there is no leftover text line below the "Transcrever" button in any state.

- [ ] **Step 12: Commit**

```bash
git add src/client/index.html src/client/style.css src/client/main.ts
git commit -m "feat: replace status line with a shared alert modal"
```
