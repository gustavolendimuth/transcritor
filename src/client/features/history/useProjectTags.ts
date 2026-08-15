import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function useProjectTags(refreshKey: number): { tags: string[]; reload: () => Promise<void> } {
  const { authFetch, isAuthenticated } = useAuth();
  const [tags, setTags] = useState<string[]>([]);

  async function reload() {
    const response = await authFetch('/api/history/tags');
    if (!response.ok) throw new Error('Não foi possível carregar as tags');
    setTags((await response.json()) as string[]);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, refreshKey]);

  return { tags, reload };
}
