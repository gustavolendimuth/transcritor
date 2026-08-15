import { attemptLogin, authFetch, clearCredentials, getCredentials } from './auth.js';
import { createAutosave, type AutosaveStatus } from './autosave.js';
import { createUploadQueue, type QueueTask } from './uploadQueue.js';
import { createTagCombobox } from './tagCombobox.js';
import { tagColorVar } from './tagColor.js';
import { LANGUAGES, LANGUAGE_LABELS } from '../shared/languages.js';

interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  projectTag: string | null;
  durationSeconds: number;
  withTimestamps: boolean;
  createdAt: string;
}

interface TranscriptionChanges {
  filename: string;
  text: string;
  projectTag: string | null;
}

interface UploadPayload {
  file: File;
  projectTag: string | null;
  withTimestamps: boolean;
  language: string;
  record?: TranscriptionRecord;
}

type AutosaveController = ReturnType<typeof createAutosave<TranscriptionChanges>>;

interface RecordEditor {
  draft: TranscriptionChanges;
  autosave: AutosaveController;
  status: AutosaveStatus;
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
const dropzoneFilename = document.getElementById('dropzone-filename') as HTMLSpanElement;
const transcribeBtn = document.getElementById('transcribe-btn') as HTMLButtonElement;
const uploadProjectTag = document.getElementById('upload-project-tag') as HTMLInputElement;
const uploadProjectTagDot = document.getElementById('upload-project-tag-dot') as HTMLElement;
const uploadProjectTagListbox = document.getElementById('upload-project-tag-listbox') as HTMLUListElement;
const uploadQueue = document.getElementById('upload-queue') as HTMLUListElement;
const alertBackdrop = document.getElementById('alert-backdrop') as HTMLDivElement;
const alertMessage = document.getElementById('alert-message') as HTMLParagraphElement;
const alertOkBtn = document.getElementById('alert-ok-btn') as HTMLButtonElement;
const resultSection = document.getElementById('result-section') as HTMLElement;
const resultText = document.getElementById('result-text') as HTMLTextAreaElement;
const resultTextCount = document.getElementById('result-text-count') as HTMLSpanElement;
const resultFilename = document.getElementById('result-filename') as HTMLInputElement;
const resultProjectTag = document.getElementById('result-project-tag') as HTMLInputElement;
const resultProjectTagDot = document.getElementById('result-project-tag-dot') as HTMLElement;
const resultProjectTagListbox = document.getElementById('result-project-tag-listbox') as HTMLUListElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const historyList = document.getElementById('history-list') as HTMLUListElement;
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;
const historyProjectFilter = document.getElementById('history-project-filter') as HTMLDivElement;
const timestampsCheckbox = document.getElementById('timestamps-checkbox') as HTMLInputElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;

for (const lang of LANGUAGES) {
  const option = document.createElement('option');
  option.value = lang;
  option.textContent = LANGUAGE_LABELS[lang];
  if (lang === 'pt') option.selected = true;
  languageSelect.append(option);
}

let selectedFiles: File[] = [];
let activeRecordId: number | null = null;
let projectTags: string[] = [];
let activeTagFilter = '';
let historyLoadVersion = 0;
const editors = new Map<number, RecordEditor>();
const queueTasks: QueueTask<UploadPayload>[] = [];

const uploadTagCombobox = createTagCombobox(
  uploadProjectTag,
  uploadProjectTagDot,
  uploadProjectTagListbox,
  () => projectTags
);
const resultTagCombobox = createTagCombobox(
  resultProjectTag,
  resultProjectTagDot,
  resultProjectTagListbox,
  () => projectTags
);

function normalizeProjectTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function setSelectedFiles(files: File[]) {
  selectedFiles = files;
  transcribeBtn.disabled = files.length === 0;
  dropZone.classList.toggle('has-file', files.length > 0);
  dropzoneFilename.textContent = files.length === 1 ? files[0].name : `${files.length} arquivos selecionados`;
}

function showAlert(message: string, type: 'error' | 'success') {
  alertMessage.textContent = message;
  alertMessage.classList.toggle('alert-message--error', type === 'error');
  alertMessage.classList.toggle('alert-message--success', type === 'success');
  alertBackdrop.hidden = false;
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

function getEditor(record: TranscriptionRecord): RecordEditor {
  const existing = editors.get(record.id);
  if (existing) return existing;

  let editor: RecordEditor;
  const autosave = createAutosave(700, async (changes) => {
    const response = await authFetch(`/api/history/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar');
    void refreshProjectTags().then(loadHistory).catch((error: unknown) => {
      showAlert(error instanceof Error ? error.message : 'Erro ao atualizar o histórico', 'error');
    });
  }, (status) => {
    editor.status = status;
  });

  editor = {
    draft: { filename: record.filename, text: record.text, projectTag: record.projectTag },
    autosave,
    status: 'saved',
  };
  editors.set(record.id, editor);
  return editor;
}

function showResult(record: TranscriptionRecord) {
  const editor = getEditor(record);
  activeRecordId = record.id;
  resultFilename.value = editor.draft.filename;
  resultText.value = editor.draft.text;
  resultProjectTag.value = editor.draft.projectTag ?? '';
  resultTagCombobox.refreshOptions();
  resultSection.hidden = false;
  updateResultTextCount();
  growResultText();
}

function updateResultTextCount() {
  const words = resultText.value.trim().match(/\S+/g)?.length ?? 0;
  resultTextCount.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
}

function growResultText() {
  resultText.style.height = 'auto';
  resultText.style.height = `${resultText.scrollHeight}px`;
}

function renderUploadQueue() {
  uploadQueue.innerHTML = '';
  uploadQueue.hidden = queueTasks.length === 0;
  for (const task of queueTasks) {
    const item = document.createElement('li');
    item.className = `upload-queue-item upload-queue-item--${task.status}`;
    const details = document.createElement('div');
    details.className = 'upload-queue-details';
    const filename = document.createElement('span');
    filename.className = 'upload-queue-filename';
    filename.textContent = task.value.file.name;
    const status = document.createElement('span');
    status.className = 'upload-queue-status';
    status.textContent = {
      queued: 'Aguardando',
      processing: 'Transcrevendo…',
      success: 'Concluído',
      error: task.error ?? 'Erro ao transcrever',
    }[task.status];
    details.append(filename, status);
    item.append(details);

    if (task.status === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn-ghost upload-queue-action';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => uploadTaskQueue.retry(task));
      item.append(retry);
    }
    if (task.status === 'success' && task.value.record) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn btn-ghost upload-queue-action';
      open.textContent = 'Abrir';
      open.addEventListener('click', () => showResult(task.value.record!));
      item.append(open);
    }
    uploadQueue.append(item);
  }
}

const uploadTaskQueue = createUploadQueue<UploadPayload>(
  3,
  async (payload) => {
    const formData = new FormData();
    formData.append('audio', payload.file);
    formData.append('withTimestamps', String(payload.withTimestamps));
    formData.append('language', payload.language);
    if (payload.projectTag) formData.append('projectTag', payload.projectTag);
    const response = await authFetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Erro ao transcrever');
    payload.record = data as TranscriptionRecord;
    void refreshProjectTags().then(loadHistory).catch((error: unknown) => {
      showAlert(error instanceof Error ? error.message : 'Erro ao atualizar o histórico', 'error');
    });
  },
  renderUploadQueue
);

async function refreshProjectTags() {
  const response = await authFetch('/api/history/tags');
  if (!response.ok) throw new Error('Não foi possível carregar as tags');
  projectTags = await response.json() as string[];
  uploadTagCombobox.refreshOptions();
  resultTagCombobox.refreshOptions();
  if (activeTagFilter && !projectTags.includes(activeTagFilter)) activeTagFilter = '';
  renderTagFilter();
}

function setTagFilter(tag: string) {
  if (activeTagFilter === tag) return;
  activeTagFilter = tag;
  renderTagFilter();
  void loadHistory();
}

function renderTagFilter() {
  historyProjectFilter.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = 'tag-filter-chip';
  allChip.textContent = 'Todas';
  allChip.setAttribute('aria-pressed', String(activeTagFilter === ''));
  allChip.classList.toggle('is-active', activeTagFilter === '');
  allChip.addEventListener('click', () => setTagFilter(''));
  historyProjectFilter.append(allChip);

  for (const tag of projectTags) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-filter-chip';
    chip.style.setProperty('--tag-color', tagColorVar(tag));
    chip.setAttribute('aria-pressed', String(activeTagFilter === tag));
    chip.classList.toggle('is-active', activeTagFilter === tag);

    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    const label = document.createElement('span');
    label.textContent = tag;
    chip.append(dot, label);

    chip.addEventListener('click', () => setTagFilter(tag));
    historyProjectFilter.append(chip);
  }
}

async function loadHistory() {
  const loadVersion = ++historyLoadVersion;
  try {
    const tag = activeTagFilter;
    const url = tag ? `/api/history?${new URLSearchParams({ projectTag: tag })}` : '/api/history';
    const response = await authFetch(url);
    if (!response.ok) throw new Error('Não foi possível carregar o histórico');
    const records: TranscriptionRecord[] = await response.json();
    if (loadVersion !== historyLoadVersion) return;
    historyList.innerHTML = '';
    historyEmpty.hidden = records.length > 0;
    for (const record of records) {
      const li = document.createElement('li');
      li.className = 'history-item';
      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'history-info';
      const timestampBadge = record.withTimestamps ? '<span class="history-badge">Com tempo</span>' : '';
      const projectBadge = record.projectTag
        ? `<span class="history-project-badge" style="--tag-color:${tagColorVar(record.projectTag)}"><span class="tag-dot" aria-hidden="true"></span>${escapeHtml(record.projectTag)}</span>`
        : '';
      info.innerHTML = `<span class="history-filename">${escapeHtml(record.filename)}${projectBadge}${timestampBadge}</span><span class="history-meta">${formatDuration(record.durationSeconds)} · ${new Date(record.createdAt).toLocaleString('pt-BR')}</span>`;
      info.addEventListener('click', () => showResult(record));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete';
      deleteBtn.setAttribute('aria-label', `Excluir ${record.filename}`);
      deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 0 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2L4 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const deleteResponse = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          showAlert('Não foi possível excluir a transcrição.', 'error');
          return;
        }
        if (activeRecordId === record.id) {
          activeRecordId = null;
          resultSection.hidden = true;
        }
        try {
          await refreshProjectTags();
        } catch (error) {
          showAlert(error instanceof Error ? error.message : 'Erro ao atualizar as tags', 'error');
        }
        await loadHistory();
      });
      li.append(info, deleteBtn);
      historyList.append(li);
    }
  } catch (error) {
    if (loadVersion !== historyLoadVersion) return;
    showAlert(error instanceof Error ? error.message : 'Erro ao carregar histórico', 'error');
  }
}

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

alertOkBtn.addEventListener('click', () => { alertBackdrop.hidden = true; });

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const ok = await attemptLogin(loginUser.value.trim(), loginPassword.value);
  if (!ok) {
    loginError.textContent = 'Usuário ou senha inválidos.';
    loginError.hidden = false;
    loginPassword.value = '';
    loginUser.focus();
    return;
  }
  loginForm.reset();
  showApp();
  try {
    await refreshProjectTags();
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Erro ao carregar as tags', 'error');
  }
  await loadHistory();
});

logoutBtn.addEventListener('click', () => { clearCredentials(); showLogin(); });
window.addEventListener('auth:unauthorized', () => { showLogin(); });
fileInput.addEventListener('change', () => { setSelectedFiles(Array.from(fileInput.files ?? [])); });
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('is-dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('is-dragover'); });
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('is-dragover');
  setSelectedFiles(Array.from(event.dataTransfer?.files ?? []));
});

transcribeBtn.addEventListener('click', () => {
  if (selectedFiles.length === 0) return;
  const payloads = selectedFiles.map((file) => ({
    file,
    projectTag: normalizeProjectTag(uploadProjectTag.value),
    withTimestamps: timestampsCheckbox.checked,
    language: languageSelect.value,
  }));
  const tasks = uploadTaskQueue.enqueue(payloads);
  queueTasks.push(...tasks);
  renderUploadQueue();
  fileInput.value = '';
  setSelectedFiles([]);
});

resultText.addEventListener('input', () => {
  updateResultTextCount();
  growResultText();
  if (activeRecordId === null) return;
  const editor = editors.get(activeRecordId);
  if (!editor) return;
  editor.draft.text = resultText.value;
  editor.autosave.schedule({ ...editor.draft });
});
resultFilename.addEventListener('input', () => {
  if (activeRecordId === null) return;
  const editor = editors.get(activeRecordId);
  if (!editor) return;
  editor.draft.filename = resultFilename.value.trim();
  editor.autosave.schedule({ ...editor.draft });
});
resultProjectTag.addEventListener('input', () => {
  if (activeRecordId === null) return;
  const editor = editors.get(activeRecordId);
  if (!editor) return;
  editor.draft.projectTag = normalizeProjectTag(resultProjectTag.value);
  editor.autosave.schedule({ ...editor.draft });
});
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  showAlert('Copiado para a área de transferência.', 'success');
});
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([resultText.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const editor = activeRecordId === null ? undefined : editors.get(activeRecordId);
  const filename = editor?.draft.filename || 'transcricao';
  a.download = filename.replace(/\.[^.]+$/, '') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
});

async function bootstrap() {
  if (getCredentials()) {
    const response = await authFetch('/api/history');
    if (response.ok) {
      showApp();
      try {
        await refreshProjectTags();
      } catch (error) {
        showAlert(error instanceof Error ? error.message : 'Erro ao carregar as tags', 'error');
      }
      await loadHistory();
      return;
    }
  }
  showLogin();
}

bootstrap();
