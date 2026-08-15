import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../../../src/client/ui/Field';

describe('Field', () => {
  it('associates the label with its child input via htmlFor/id', () => {
    render(
      <Field label="Usuário" htmlFor="login-user">
        <input id="login-user" />
      </Field>
    );
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
  });

  it('renders an error message when provided', () => {
    render(
      <Field label="Usuário" htmlFor="login-user" error="Campo obrigatório">
        <input id="login-user" />
      </Field>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório');
  });
});
