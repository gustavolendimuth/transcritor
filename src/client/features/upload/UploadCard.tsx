import { useRef, useState, type DragEvent } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { Combobox } from '../../ui/Combobox';
import { LANGUAGES, LANGUAGE_LABELS } from '../../../shared/languages';
import { useUploadQueueFeature, type UploadPayload } from './useUploadQueueFeature';
import type { TranscriptionRecord } from '../../types';

export interface UploadCardProps {
  tags: string[];
  onRecordCreated: (record: TranscriptionRecord) => void;
  onOpenRecord: (record: TranscriptionRecord) => void;
}

function normalizeProjectTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function UploadCard({ tags, onRecordCreated, onOpenRecord }: UploadCardProps) {
  const { tasks, enqueue, retry } = useUploadQueueFeature(onRecordCreated);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [withTimestamps, setWithTimestamps] = useState(false);
  const [language, setLanguage] = useState('pt');
  const [projectTag, setProjectTag] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    setSelectedFiles(Array.from(event.dataTransfer.files));
  }

  function handleTranscribe() {
    if (selectedFiles.length === 0) return;
    const payloads: UploadPayload[] = selectedFiles.map((file) => ({
      file,
      projectTag: normalizeProjectTag(projectTag),
      withTimestamps,
      language,
    }));
    enqueue(payloads);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const fileSummary =
    selectedFiles.length === 1 ? selectedFiles[0].name : selectedFiles.length > 1 ? `${selectedFiles.length} arquivos selecionados` : '';

  return (
    <Card>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 min-h-[140px] border-2 border-dashed rounded-lg text-center p-4 mb-3 cursor-pointer transition-colors ${
          isDragOver || selectedFiles.length > 0 ? 'border-ctp-mauve bg-ctp-mauve/5' : 'border-ctp-surface2 text-ctp-subtext0'
        }`}
      >
        {selectedFiles.length === 0 ? (
          <span>Arraste áudios ou vídeos aqui ou clique para escolher</span>
        ) : (
          <span className="flex flex-col items-center gap-1">
            <span className="text-ctp-text text-[0.9375rem] break-all">{fileSummary}</span>
            <small className="text-ctp-subtext0 text-[0.8125rem]">Clique para trocar o arquivo</small>
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      <p className="text-ctp-subtext0 text-sm mb-3">
        Em vídeos, somente o áudio é extraído. Dependendo do tamanho do arquivo, o upload e a transcrição podem demorar
        alguns minutos.
      </p>
      <div className="flex flex-col gap-3 mb-3">
        <label className="flex items-start gap-2 text-[0.9375rem] cursor-pointer">
          <input
            type="checkbox"
            checked={withTimestamps}
            onChange={(event) => setWithTimestamps(event.target.checked)}
            className="mt-0.5 w-4 h-4 accent-ctp-mauve cursor-pointer"
          />
          <span>
            Adicionar tempo às falas
            <small className="block text-ctp-subtext0 text-[0.8125rem] font-normal mt-0.5">
              Adiciona o tempo de cada trecho falado ao texto. Isso usa outro modelo de transcrição e pode reduzir um
              pouco a qualidade — se notar isso, tente novamente sem marcar esta opção.
            </small>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span>Idioma</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2 text-[0.9375rem]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span>Tag</span>
          <Combobox id="upload-project-tag" value={projectTag} onChange={setProjectTag} options={tags} placeholder="Ex.: Cliente Acme" />
        </label>
      </div>
      <Button onClick={handleTranscribe} disabled={selectedFiles.length === 0}>
        Transcrever
      </Button>
      {tasks.length > 0 && (
        <ul className="list-none p-0 mt-3 border-t border-ctp-surface1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 py-2 border-b border-ctp-surface1">
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="truncate text-ctp-text text-[0.9375rem]">{task.value.file.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-xs ${
                    task.status === 'error' ? 'text-ctp-red' : task.status === 'success' ? 'text-ctp-green' : 'text-ctp-subtext0'
                  }`}
                >
                  {task.status === 'processing' && <Spinner size="sm" />}
                  {task.status === 'queued' && 'Aguardando'}
                  {task.status === 'processing' && 'Transcrevendo…'}
                  {task.status === 'success' && 'Concluído'}
                  {task.status === 'error' && (task.error ?? 'Erro ao transcrever')}
                </span>
              </div>
              {task.status === 'error' && (
                <Button variant="ghost" onClick={() => retry(task)}>
                  Tentar novamente
                </Button>
              )}
              {task.status === 'success' && task.value.record && (
                <Button variant="ghost" onClick={() => onOpenRecord(task.value.record!)}>
                  Abrir
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
