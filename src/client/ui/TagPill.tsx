import { tagColorVar } from '../lib/tagColor';

export interface TagPillProps {
  tag: string;
  active?: boolean;
  onClick?: () => void;
}

export function TagPill({ tag, active = false, onClick }: TagPillProps) {
  const style = { '--tag-color': tagColorVar(tag) } as React.CSSProperties;
  const content = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tag-color)]" aria-hidden="true" />
      <span>{tag}</span>
    </>
  );

  const classes = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
    active
      ? 'border-[var(--tag-color)] text-[var(--tag-color)] bg-[color-mix(in_srgb,var(--tag-color)_18%,transparent)]'
      : 'border-ctp-surface1 text-ctp-subtext1'
  }`;

  if (!onClick) {
    return (
      <span style={style} className={classes}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" style={style} onClick={onClick} aria-pressed={active} className={`${classes} cursor-pointer hover:border-ctp-surface2`}>
      {content}
    </button>
  );
}
