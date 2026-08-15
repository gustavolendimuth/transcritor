import { useState, type FormEvent } from 'react';
import { Card } from '../../ui/Card';
import { Field } from '../../ui/Field';
import { Button } from '../../ui/Button';
import { Waveform } from '../../ui/Waveform';
import { useAuth } from './AuthContext';

export function LoginScreen() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    let ok: boolean;
    try {
      ok = await login(user.trim(), password);
    } catch {
      setError('Não foi possível entrar. Verifique a conexão e tente novamente.');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    if (!ok) {
      setError('Usuário ou senha inválidos.');
      setPassword('');
      return;
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(17,17,27,0.72)] p-3">
      <Card className="w-full max-w-sm flex flex-col items-center text-center gap-1">
        <Waveform className="mb-2" />
        <h1 className="font-display text-2xl -tracking-[0.01em]">Transcritor</h1>
        <p className="text-ctp-subtext0 text-[0.9375rem] mb-3">Entre para continuar</p>
        <form onSubmit={handleSubmit} className="w-full">
          <Field label="Usuário" htmlFor="login-user">
            <input
              id="login-user"
              type="text"
              autoComplete="username"
              required
              disabled={isSubmitting}
              value={user}
              onChange={(event) => setUser(event.target.value)}
              className="w-full bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2.5 text-[0.9375rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ctp-mauve"
            />
          </Field>
          <Field label="Senha" htmlFor="login-password" error={error ?? undefined}>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2.5 text-[0.9375rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ctp-mauve"
            />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
