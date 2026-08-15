import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AlertProvider } from './features/alert/AlertContext';
import { LoginScreen } from './features/auth/LoginScreen';
import { BootLoading } from './ui/BootLoading';
import { Header } from './ui/Header';

function AppShell() {
  const { isAuthenticated, isBootstrapping, logout } = useAuth();

  if (isBootstrapping) return <BootLoading />;
  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 pb-12">
      <Header onLogout={logout} />
      <main data-testid="authenticated-app" />
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
