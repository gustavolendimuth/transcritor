import type { ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  inline?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, inline = false, children }: FieldProps) {
  return (
    <div className={`w-full text-sm text-ctp-subtext1 mb-3 ${inline ? 'flex flex-row items-center gap-2' : 'flex flex-col gap-1.5'}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small className="text-ctp-subtext0 text-xs">{hint}</small>}
      {error && (
        <p role="alert" className="text-ctp-red text-sm m-0">
          {error}
        </p>
      )}
    </div>
  );
}
