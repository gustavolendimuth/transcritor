import { Card } from '../../ui/Card';
import { Field } from '../../ui/Field';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { useAlert } from '../alert/AlertContext';
import { useRecordAutosave } from './useRecordAutosave';
import type { TranscriptionRecord } from '../../types';

export interface ResultEditorProps {
  record: TranscriptionRecord;
  tags: string[];
  onSaved: () => void;
}

function normalizeProjectTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function ResultEditor({ record, tags, onSaved }: ResultEditorProps) {
  const { showAlert } = useAlert();
  const { draft, updateField } = useRecordAutosave(record, onSaved);

  const wordCount = draft.text.trim().match(/\S+/g)?.length ?? 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft.text);
      showAlert('Copiado para a área de transferência.', { variant: 'success' });
    } catch {
      showAlert('Não foi possível copiar para a área de transferência.');
    }
  }

  function handleDownload() {
    const blob = new Blob([draft.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(draft.filename || 'transcricao').replace(/\.[^.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <h2 className="font-display text-lg mb-3">Resultado</h2>
      <Field label="Nome da transcrição" htmlFor="result-filename">
        <input
          id="result-filename"
          type="text"
          value={draft.filename}
          onChange={(event) => updateField('filename', event.target.value)}
          className="w-full bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2.5 text-[0.9375rem]"
        />
      </Field>
      <Field label="Tag" htmlFor="result-project-tag">
        <Combobox
          id="result-project-tag"
          value={draft.projectTag ?? ''}
          onChange={(value) => updateField('projectTag', normalizeProjectTag(value))}
          options={tags}
          placeholder="Sem tag"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor="result-text" className="inline-flex items-center gap-1.5 text-ctp-subtext1 text-sm">
          Transcrição
        </label>
        <span className="text-ctp-overlay0 font-mono text-xs">
          {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
        </span>
      </div>
      <textarea
        id="result-text"
        placeholder="Edite o texto da transcrição aqui…"
        value={draft.text}
        onChange={(event) => updateField('text', event.target.value)}
        className="block w-full min-h-[220px] max-h-[60vh] resize-y bg-ctp-mantle text-ctp-text border border-ctp-surface1 rounded-lg p-3 text-[0.9375rem] leading-relaxed focus-visible:outline-none focus-visible:border-ctp-mauve"
      />
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" onClick={handleCopy}>
          Copiar
        </Button>
        <Button variant="secondary" onClick={handleDownload}>
          Baixar
        </Button>
      </div>
    </Card>
  );
}
