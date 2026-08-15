import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { attemptLogin, authFetch, clearCredentials, getCredentials } from '../../lib/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login(user: string, password: string): Promise<boolean>;
  logout(): void;
  authFetch: typeof authFetch;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (getCredentials()) {
        try {
          const response = await authFetch('/api/history');
          if (!cancelled && response.ok) {
            setIsAuthenticated(true);
          }
        } catch {
          // Falls through to the unauthenticated state below.
        }
      }
      if (!cancelled) setIsBootstrapping(false);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <AuthContext.Provider value={{ isAuthenticated, isBootstrapping, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
