import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';

export interface AlertOptions {
  variant?: 'success' | 'error';
  onRetry?: () => void;
}

interface AlertState {
  message: string;
  variant: 'success' | 'error';
  onRetry?: () => void;
}

interface AlertContextValue {
  showAlert(message: string, options?: AlertOptions): void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = useCallback((message: string, options: AlertOptions = {}) => {
    setAlert({ message, variant: options.variant ?? 'error', onRetry: options.onRetry });
  }, []);

  function close() {
    setAlert(null);
  }

  function retry() {
    const onRetry = alert?.onRetry;
    close();
    onRetry?.();
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal open={alert !== null} labelledBy="alert-message">
        {alert && (
          <>
            <p id="alert-message" className={`m-0 text-[0.9375rem] ${alert.variant === 'error' ? 'text-ctp-red' : 'text-ctp-green'}`}>
              {alert.message}
            </p>
            <div className="flex gap-2 w-full mt-2">
              {alert.onRetry && (
                <Button variant="primary" className="flex-1" onClick={retry}>
                  Tentar novamente
                </Button>
              )}
              <Button variant={alert.onRetry ? 'ghost' : 'primary'} className="flex-1" onClick={close}>
                {alert.onRetry ? 'Fechar' : 'OK'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
}
