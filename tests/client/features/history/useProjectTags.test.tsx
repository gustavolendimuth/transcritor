import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { useProjectTags } from '../../../../src/client/features/history/useProjectTags';

function TagsProbe({ refreshKey }: { refreshKey: number }) {
  const { tags } = useProjectTags(refreshKey);
  return <p>{tags.join(', ') || 'sem tags'}</p>;
}

function renderProbe(refreshKey: number) {
  return render(
    <AuthProvider>
      <AlertProvider>
        <TagsProbe refreshKey={refreshKey} />
      </AlertProvider>
    </AuthProvider>
  );
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
    renderProbe(0);
    await waitFor(() => expect(screen.getByText('Cliente Acme, Interno')).toBeInTheDocument());
  });

  it('refetches when refreshKey changes', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(['A']), { status: 200 }));
    const { rerender } = render(
      <AuthProvider>
        <AlertProvider>
          <TagsProbe refreshKey={0} />
        </AlertProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(['A', 'B']), { status: 200 }));
    rerender(
      <AuthProvider>
        <AlertProvider>
          <TagsProbe refreshKey={1} />
        </AlertProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('A, B')).toBeInTheDocument());
  });

  it('shows an alert with a retry when the tags fail to load', async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(() => {
      callCount += 1;
      // Call #1 is AuthContext's bootstrap check — must succeed so isAuthenticated becomes true.
      if (callCount === 1) return Promise.resolve(new Response(null, { status: 200 }));
      // Call #2 is useProjectTags' reload() — this is the one that must fail.
      return Promise.resolve(new Response(null, { status: 500 }));
    });
    renderProbe(0);
    expect(await screen.findByText('Não foi possível carregar as tags')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
