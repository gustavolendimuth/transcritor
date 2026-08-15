import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { attemptLogin, authFetch, clearCredentials, getCredentials } from '../../lib/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  bootstrapError: string | null;
  retryBootstrap(): void;
  login(user: string, password: string): Promise<boolean>;
  logout(): void;
  authFetch: typeof authFetch;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setBootstrapError(null);
      if (getCredentials()) {
        try {
          const response = await authFetch('/api/history');
          if (!cancelled && response.ok) {
            setIsAuthenticated(true);
          }
        } catch {
          if (!cancelled) setBootstrapError('Não foi possível conectar ao servidor.');
        }
      }
      if (!cancelled) setIsBootstrapping(false);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [bootstrapAttempt]);

  function retryBootstrap() {
    setIsBootstrapping(true);
    setBootstrapAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    function handleUnauthorized() {
      setIsAuthenticated(false);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(user: string, password: string): Promise<boolean> {
    const ok = await attemptLogin(user, password);
    if (ok) setIsAuthenticated(true);
    return ok;
  }

  function logout() {
    clearCredentials();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isBootstrapping, bootstrapError, retryBootstrap, login, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
