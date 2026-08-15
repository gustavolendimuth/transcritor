import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertProvider, useAlert } from '../../../../src/client/features/alert/AlertContext';

function TriggerButton({ onRetry }: { onRetry?: () => void }) {
  const { showAlert } = useAlert();
  return (
    <button onClick={() => showAlert('Não foi possível salvar.', { variant: 'error', onRetry })}>
      Disparar
    </button>
  );
}

describe('AlertContext', () => {
  it('shows the message when showAlert is called', async () => {
    render(
      <AlertProvider>
        <TriggerButton />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    expect(screen.getByText('Não foi possível salvar.')).toBeInTheDocument();
  });

  it('shows a retry button when onRetry is given, and calls it', async () => {
    const onRetry = vi.fn();
    render(
      <AlertProvider>
        <TriggerButton onRetry={onRetry} />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('closes the alert when OK is clicked', async () => {
    render(
      <AlertProvider>
        <TriggerButton />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Não foi possível salvar.')).not.toBeInTheDocument();
  });
});
