export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'w-3 h-3 border-2',
  md: 'w-4 h-4 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block flex-shrink-0 rounded-full border-ctp-surface2 border-t-ctp-mauve
        animate-spin ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
