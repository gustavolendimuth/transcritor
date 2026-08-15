import { TagPill } from '../../ui/TagPill';

export interface HistoryTagFilterProps {
  tags: string[];
  activeTag: string;
  onChange: (tag: string) => void;
}

export function HistoryTagFilter({ tags, activeTag, onChange }: HistoryTagFilterProps) {
  return (
    <div role="group" aria-label="Filtrar por tag" className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        aria-pressed={activeTag === ''}
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
          activeTag === '' ? 'border-ctp-mauve text-ctp-mauve' : 'border-ctp-surface1 text-ctp-subtext1'
        }`}
      >
        Todas
      </button>
      {tags.map((tag) => (
        <TagPill key={tag} tag={tag} active={activeTag === tag} onClick={() => onChange(tag)} />
      ))}
    </div>
  );
}
