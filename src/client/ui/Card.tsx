import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-lg p-4 sm:p-6 mb-4 ${className}`}>
      {children}
    </section>
  );
}
