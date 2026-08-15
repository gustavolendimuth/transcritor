import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAlert } from '../alert/AlertContext';

export function useProjectTags(refreshKey: number): { tags: string[]; reload: () => Promise<void> } {
  const { authFetch, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const [tags, setTags] = useState<string[]>([]);

  async function reload() {
    const response = await authFetch('/api/history/tags');
    if (!response.ok) throw new Error('Não foi possível carregar as tags');
    setTags((await response.json()) as string[]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    async function reloadWithAlert() {
      try {
        await reload();
      } catch {
        showAlert('Não foi possível carregar as tags', { onRetry: () => void reload() });
      }
    }
    void reloadWithAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, refreshKey]);

  return { tags, reload };
}
