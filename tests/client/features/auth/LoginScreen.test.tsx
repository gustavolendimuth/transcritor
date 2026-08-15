import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { LoginScreen } from '../../../../src/client/features/auth/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error message on invalid credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
    await userEvent.type(screen.getByLabelText('Usuário'), 'alice');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Usuário ou senha inválidos.')).toBeInTheDocument();
  });
});
