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
