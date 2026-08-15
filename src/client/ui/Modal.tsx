import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  labelledBy?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, labelledBy, children }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-10 flex items-center justify-center bg-[rgba(17,17,27,0.72)] backdrop-blur-sm p-3"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-sm bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center gap-2"
      >
        {children}
      </div>
    </div>
  );
}
