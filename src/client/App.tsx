import { useEffect } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AlertProvider, useAlert } from './features/alert/AlertContext';
import { LoginScreen } from './features/auth/LoginScreen';
import { MainApp } from './features/MainApp';
import { BootLoading } from './ui/BootLoading';
import { Header } from './ui/Header';

function AppShell() {
  const { isAuthenticated, isBootstrapping, bootstrapError, retryBootstrap, logout } = useAuth();
  const { showAlert } = useAlert();

  useEffect(() => {
    if (bootstrapError) showAlert(bootstrapError, { onRetry: retryBootstrap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapError]);

  if (isBootstrapping) return <BootLoading />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-12">
      <Header onLogout={logout} />
      <MainApp />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AlertProvider>
        <AppShell />
      </AlertProvider>
    </AuthProvider>
  );
}
