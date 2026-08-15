import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { useProjectTags } from '../../../../src/client/features/history/useProjectTags';

function TagsProbe({ refreshKey }: { refreshKey: number }) {
  const { tags } = useProjectTags(refreshKey);
  return <p>{tags.join(', ') || 'sem tags'}</p>;
}

describe('useProjectTags', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('transcritor:credentials', btoa('test:test'));
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads tags from GET /api/history/tags', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(['Cliente Acme', 'Interno']), { status: 200 }));
    render(
      <AuthProvider>
        <TagsProbe refreshKey={0} />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Cliente Acme, Interno')).toBeInTheDocument());
  });

  it('refetches when refreshKey changes', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(['A']), { status: 200 }));
    const { rerender } = render(
      <AuthProvider>
        <TagsProbe refreshKey={0} />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(['A', 'B']), { status: 200 }));
    rerender(
      <AuthProvider>
        <TagsProbe refreshKey={1} />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('A, B')).toBeInTheDocument());
  });
});
