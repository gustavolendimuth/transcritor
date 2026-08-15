import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-ctp-mauve text-ctp-mantle hover:enabled:bg-ctp-mauve-dim disabled:bg-ctp-surface2 disabled:text-ctp-overlay0',
  secondary: 'bg-ctp-surface1 text-ctp-text hover:bg-ctp-surface2',
  ghost: 'bg-transparent text-ctp-subtext0 border border-ctp-surface1 hover:text-ctp-text hover:border-ctp-surface2',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[0.9375rem] font-medium
        transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ctp-mauve
        focus-visible:outline-offset-2 disabled:cursor-not-allowed ${loading ? 'cursor-wait' : ''}
        ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  );
}
