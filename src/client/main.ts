import { attemptLogin, authFetch, clearCredentials, getCredentials } from './auth.js';
import { LANGUAGES, LANGUAGE_LABELS } from '../shared/languages.js';

interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  durationSeconds: number;
  withTimestamps: boolean;
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
const dropzoneFilename = document.getElementById('dropzone-filename') as HTMLSpanElement;
const transcribeBtn = document.getElementById('transcribe-btn') as HTMLButtonElement;
const alertBackdrop = document.getElementById('alert-backdrop') as HTMLDivElement;
const alertMessage = document.getElementById('alert-message') as HTMLParagraphElement;
const alertOkBtn = document.getElementById('alert-ok-btn') as HTMLButtonElement;
const loadingBackdrop = document.getElementById('loading-backdrop') as HTMLDivElement;
const resultSection = document.getElementById('result-section') as HTMLElement;
const resultText = document.getElementById('result-text') as HTMLTextAreaElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const historyList = document.getElementById('history-list') as HTMLUListElement;
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;
const timestampsCheckbox = document.getElementById('timestamps-checkbox') as HTMLInputElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;

for (const lang of LANGUAGES) {
  const option = document.createElement('option');
  option.value = lang;
  option.textContent = LANGUAGE_LABELS[lang];
  if (lang === 'pt') option.selected = true;
  languageSelect.append(option);
}

let selectedFile: File | null = null;
let currentFilename = 'transcricao.txt';

function setSelectedFile(file: File | null) {
  selectedFile = file;
  transcribeBtn.disabled = !file;
  dropZone.classList.toggle('has-file', Boolean(file));
  dropzoneFilename.textContent = file ? file.name : '';
}

function showAlert(message: string, type: 'error' | 'success') {
  alertMessage.textContent = message;
  alertMessage.classList.toggle('alert-message--error', type === 'error');
  alertMessage.classList.toggle('alert-message--success', type === 'success');
  alertBackdrop.hidden = false;
}

alertOkBtn.addEventListener('click', () => {
  alertBackdrop.hidden = true;
});

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
  setSelectedFile(fileInput.files?.[0] ?? null);
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
    setSelectedFile(file);
  }
});

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

function showResult(record: TranscriptionRecord) {
  resultText.value = record.text;
  currentFilename = record.filename.replace(/\.[^.]+$/, '') + '.txt';
  resultSection.hidden = false;
}

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultText.value);
  showAlert('Copiado para a área de transferência.', 'success');
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
      const badge = record.withTimestamps
        ? '<span class="history-badge">Com tempo</span>'
        : '';
      info.innerHTML = `<span class="history-filename">${escapeHtml(record.filename)}${badge}</span><span class="history-meta">${duration} · ${new Date(record.createdAt).toLocaleString('pt-BR')}</span>`;
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
          showAlert('Não foi possível excluir a transcrição.', 'error');
          return;
        }
        await loadHistory();
      });

      li.append(info, deleteBtn);
      historyList.append(li);
    }
  } catch (error) {
    showAlert(error instanceof Error ? error.message : 'Erro ao carregar histórico', 'error');
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
