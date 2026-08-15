import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../../src/client/ui/Button';

describe('Button', () => {
  it('renders children and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Entrar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows a spinner and disables the button when loading', () => {
    render(<Button loading>Entrar</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.queryByText('Entrar')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
  });
});
