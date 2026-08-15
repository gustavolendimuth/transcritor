# Migração do Frontend para React + Tailwind — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vanilla TypeScript/DOM frontend in `src/client/` with a React + Tailwind CSS single-page app that keeps the same visual identity (fonts, waveform motif, Catppuccin Mocha palette) with more consistent execution, is responsive/touch-friendly, and talks to the unchanged Express backend.

**Architecture:** A React app built with Vite (`@vitejs/plugin-react`), styled with Tailwind CSS. A small `ui/` kit of primitives (Button, Field, Card, Modal, TagPill, Combobox, Spinner, Waveform) is built first, then composed into feature areas (`features/auth`, `features/upload`, `features/editor`, `features/history`, `features/alert`). The three existing framework-agnostic logic modules (`autosave.ts`, `uploadQueue.ts`, `auth.ts`, minus DOM-coupled parts of `tagColor.ts`) move to `lib/` almost unchanged and are wrapped by thin hooks. State is plain React (`useState`/`useContext`), no external state library. The new app is built alongside the existing vanilla client and only replaces it in the final task (big-bang cutover, not incremental coexistence in production).

**Tech Stack:** React 18, `@vitejs/plugin-react`, Tailwind CSS 3, Vitest + `@testing-library/react` + `jsdom`, TypeScript (strict).

**Spec:** `docs/superpowers/specs/2026-08-15-react-frontend-migration-design.md`

## Global Constraints

- No external state management library — only `useState`/`useReducer`/`useContext`.
- No dark mode / theme toggle in this phase.
- No routing library (`react-router`) — single-screen app with conditional sections.
- No Capacitor / mobile packaging in this phase — that is a separate future spec.
- Backend (`src/server/`) and its API contracts are not modified.
- Visual identity is preserved: Fraunces (display) + IBM Plex Sans/Mono (body/mono) fonts, waveform motif, Catppuccin Mocha palette (`--ctp-*` tokens from the current `style.css`).
- Layout must be responsive (mobile/touch-friendly) from this phase on.
- Migration is big-bang: the old vanilla client (`main.ts`, `style.css`, `auth.ts`, `autosave.ts`, `uploadQueue.ts`, `tagCombobox.ts`, `tagColor.ts` at `src/client/` root) is deleted in the final task, not kept running in parallel in production.

---

## Task 1: Project scaffolding — React, Tailwind, Testing Library

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Modify: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/client/index.css`
- Create: `tests/client/setup.ts`
- Create: `tests/client/smoke.test.tsx`

**Interfaces:**
- Produces: Tailwind utility classes available in any `.tsx` under `src/client/`; `ctp-*` color tokens (`ctp-base`, `ctp-mantle`, `ctp-surface0`, `ctp-surface1`, `ctp-surface2`, `ctp-overlay0`, `ctp-text`, `ctp-subtext0`, `ctp-subtext1`, `ctp-mauve`, `ctp-mauve-dim`, `ctp-green`, `ctp-red`, `ctp-yellow`, `ctp-peach`, `ctp-teal`, `ctp-sky`, `ctp-blue`, `ctp-pink`); font families `font-display`, `font-body`, `font-mono`; CSS custom properties `--tag-color-0` through `--tag-color-7` on `:root`; a `.waveform-bar` class with the pulse keyframe. `tests/client/setup.ts` is wired as the Vitest setup file for jsdom tests.

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom
npm install -D @vitejs/plugin-react @types/react @types/react-dom \
  tailwindcss@^3 postcss autoprefixer \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add Tailwind config**

Create `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/client/index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ctp-base': '#1e1e2e',
        'ctp-mantle': '#181825',
        'ctp-surface0': '#313244',
        'ctp-surface1': '#45475a',
        'ctp-surface2': '#585b70',
        'ctp-overlay0': '#6c7086',
        'ctp-text': '#cdd6f4',
        'ctp-subtext0': '#a6adc8',
        'ctp-subtext1': '#bac2de',
        'ctp-mauve': '#cba6f7',
        'ctp-mauve-dim': '#b592e8',
        'ctp-green': '#a6e3a1',
        'ctp-red': '#f38ba8',
        'ctp-yellow': '#f9e2af',
        'ctp-peach': '#fab387',
        'ctp-teal': '#94e2d5',
        'ctp-sky': '#89dceb',
        'ctp-blue': '#89b4fa',
        'ctp-pink': '#f5c2e7',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'serif'],
        body: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Create `postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Add the global stylesheet**

Create `src/client/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: dark;
    --tag-color-0: #fab387;
    --tag-color-1: #f9e2af;
    --tag-color-2: #a6e3a1;
    --tag-color-3: #94e2d5;
    --tag-color-4: #89dceb;
    --tag-color-5: #89b4fa;
    --tag-color-6: #f5c2e7;
    --tag-color-7: #f38ba8;
  }

  body {
    @apply bg-ctp-base text-ctp-text font-body;
  }
}

@layer components {
  .waveform-bar {
    animation: waveform-pulse 1.2s ease-in-out infinite;
  }
}

@keyframes waveform-pulse {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .waveform-bar {
    animation: none;
    transform: scaleY(0.7);
  }
}
```

- [ ] **Step 4: Wire the React plugin into Vite**

Modify `vite.config.ts`:

```ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'src/client',
    plugins: [react()],
    build: {
      outDir: '../../dist/client',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_PORT ?? 5173),
      proxy: {
        '/api': 'http://localhost:3011',
      },
    },
  };
});
```

- [ ] **Step 5: Enable JSX in TypeScript**

Modify `tsconfig.json` — add `"jsx": "react-jsx"` to `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 6: Configure Vitest for jsdom + Testing Library**

Modify `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [['tests/client/**', 'jsdom']],
    setupFiles: ['./tests/client/setup.ts'],
  },
});
```

Create `tests/client/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Write a smoke test to verify the toolchain**

Create `tests/client/smoke.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

function Greeting() {
  return <p className="text-ctp-mauve">Hello, Transcritor</p>;
}

describe('React + Testing Library wiring', () => {
  it('renders a component and finds it by text', () => {
    render(<Greeting />);
    expect(screen.getByText('Hello, Transcritor')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the smoke test**

Run: `npx vitest run tests/client/smoke.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 9: Verify typecheck and existing test suite still pass**

Run: `npm run typecheck && npm test`
Expected: both succeed — this task only adds tooling, no existing file changed behavior.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts tsconfig.json \
  tailwind.config.ts postcss.config.js src/client/index.css tests/client/setup.ts \
  tests/client/smoke.test.tsx
git commit -m "chore: scaffold React, Tailwind and Testing Library"
```

---

## Task 2: Port framework-agnostic logic to `lib/`

**Files:**
- Create: `src/client/lib/auth.ts`
- Create: `src/client/lib/autosave.ts`
- Create: `src/client/lib/uploadQueue.ts`
- Create: `src/client/lib/tagColor.ts`
- Create: `src/client/types.ts`
- Test: `tests/client/lib/auth.test.ts`
- Test: `tests/client/lib/autosave.test.ts`
- Test: `tests/client/lib/uploadQueue.test.ts`
- Test: `tests/client/lib/tagColor.test.ts`

**Interfaces:**
- Produces: `getCredentials(): string | null`, `clearCredentials(): void`, `attemptLogin(user: string, password: string): Promise<boolean>`, `authFetch(input: RequestInfo, init?: RequestInit): Promise<Response>` from `lib/auth.ts`.
- Produces: `AutosaveStatus = 'saving' | 'saved' | 'error'`, `createAutosave<T>(delayMs: number, save: (value: T) => Promise<void>, onStatus: (status: AutosaveStatus) => void): { schedule(value: T): void; retry(): void }` from `lib/autosave.ts`.
- Produces: `QueueStatus = 'queued' | 'processing' | 'success' | 'error'`, `QueueTask<T> = { id: string; value: T; status: QueueStatus; error?: string }`, `createUploadQueue<T>(concurrency: number, execute: (value: T) => Promise<void>, onChange: (task: QueueTask<T>) => void): { enqueue(values: T[]): QueueTask<T>[]; retry(task: QueueTask<T>): void }` from `lib/uploadQueue.ts`.
- Produces: `tagColorVar(tag: string): string` from `lib/tagColor.ts` (returns `var(--tag-color-N)`).
- Produces: `TranscriptionRecord` and `TranscriptionChanges` interfaces from `src/client/types.ts`.
- Note: the old top-level files (`src/client/auth.ts`, `autosave.ts`, `uploadQueue.ts`, `tagColor.ts`, `tagCombobox.ts`) are left untouched in this task — the still-running old vanilla app depends on them. They are deleted in Task 13.

- [ ] **Step 1: Create the shared types file**

Create `src/client/types.ts`:

```ts
export interface TranscriptionRecord {
  id: number;
  filename: string;
  text: string;
  projectTag: string | null;
  durationSeconds: number;
  withTimestamps: boolean;
  createdAt: string;
}

export interface TranscriptionChanges {
  filename: string;
  text: string;
  projectTag: string | null;
}
```

- [ ] **Step 2: Port `auth.ts` and its test**

Create `src/client/lib/auth.ts` (identical logic to the current `src/client/auth.ts`):

```ts
const STORAGE_KEY = 'transcritor:credentials';

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function getCredentials(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearCredentials(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function attemptLogin(user: string, password: string): Promise<boolean> {
  const encoded = toBase64(`${user}:${password}`);
  const response = await fetch('/api/history', {
    headers: { Authorization: `Basic ${encoded}` },
  });
  if (response.ok) {
    sessionStorage.setItem(STORAGE_KEY, encoded);
    return true;
  }
  return false;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const credentials = getCredentials();
  const headers = new Headers(init.headers);
  if (credentials) {
    headers.set('Authorization', `Basic ${credentials}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearCredentials();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  return response;
}
```

Create `tests/client/lib/auth.test.ts` (copy the current `tests/client/auth.test.ts` if it exists; if it doesn't exist yet, write it fresh):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attemptLogin, authFetch, clearCredentials, getCredentials } from '../../../src/client/lib/auth';

describe('lib/auth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores base64 credentials on successful login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const ok = await attemptLogin('alice', 'secret');
    expect(ok).toBe(true);
    expect(getCredentials()).toBe(btoa('alice:secret'));
  });

  it('does not store credentials on failed login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const ok = await attemptLogin('alice', 'wrong');
    expect(ok).toBe(false);
    expect(getCredentials()).toBeNull();
  });

  it('authFetch clears credentials and dispatches auth:unauthorized on 401', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    await authFetch('/api/history');

    expect(getCredentials()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('auth:unauthorized', listener);
  });

  it('clearCredentials removes stored value', () => {
    sessionStorage.setItem('transcritor:credentials', 'abc');
    clearCredentials();
    expect(getCredentials()).toBeNull();
  });
});
```

- [ ] **Step 3: Port `autosave.ts` and its test**

Create `src/client/lib/autosave.ts` (identical to current `src/client/autosave.ts`):

```ts
export type AutosaveStatus = 'saving' | 'saved' | 'error';

export function createAutosave<T>(
  delayMs: number,
  save: (value: T) => Promise<void>,
  onStatus: (status: AutosaveStatus) => void
) {
  let pendingValue: T;
  let hasPendingValue = false;
  let failedValue: T;
  let hasFailedValue = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function trigger() {
    timer = undefined;
    if (inFlight || !hasPendingValue) return;

    const value = pendingValue;
    hasPendingValue = false;
    inFlight = true;
    onStatus('saving');

    void save(value)
      .then(() => {
        hasFailedValue = false;
        if (!hasPendingValue) onStatus('saved');
      })
      .catch(() => {
        failedValue = value;
        hasFailedValue = true;
        onStatus('error');
      })
      .finally(() => {
        inFlight = false;
        if (hasPendingValue && !timer) trigger();
      });
  }

  function scheduleTrigger() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(trigger, delayMs);
  }

  return {
    schedule(value: T) {
      pendingValue = value;
      hasPendingValue = true;
      scheduleTrigger();
    },
    retry() {
      if (!hasFailedValue) return;
      pendingValue = failedValue;
      hasPendingValue = true;
      hasFailedValue = false;
      if (timer) clearTimeout(timer);
      trigger();
    },
  };
}
```

Create `tests/client/lib/autosave.test.ts` by copying the existing `tests/client/autosave.test.ts` content, updating only the import path to `../../../src/client/lib/autosave`.

- [ ] **Step 4: Port `uploadQueue.ts` and its test**

Create `src/client/lib/uploadQueue.ts` (identical to current `src/client/uploadQueue.ts`):

```ts
export type QueueStatus = 'queued' | 'processing' | 'success' | 'error';

export interface QueueTask<T> {
  id: string;
  value: T;
  status: QueueStatus;
  error?: string;
}

export function createUploadQueue<T>(
  concurrency: number,
  execute: (value: T) => Promise<void>,
  onChange: (task: QueueTask<T>) => void
) {
  const tasks: QueueTask<T>[] = [];
  let activeCount = 0;
  let nextId = 1;

  function drain() {
    while (activeCount < concurrency) {
      const task = tasks.find((item) => item.status === 'queued');
      if (!task) return;

      activeCount += 1;
      task.status = 'processing';
      task.error = undefined;
      onChange(task);

      void execute(task.value)
        .then(() => {
          task.status = 'success';
        })
        .catch((error: unknown) => {
          task.status = 'error';
          task.error = error instanceof Error ? error.message : 'Erro ao transcrever';
        })
        .finally(() => {
          activeCount -= 1;
          onChange(task);
          drain();
        });
    }
  }

  return {
    enqueue(values: T[]): QueueTask<T>[] {
      const newTasks = values.map((value) => ({
        id: `upload-${nextId++}`,
        value,
        status: 'queued' as const,
      }));
      tasks.push(...newTasks);
      for (const task of newTasks) onChange(task);
      drain();
      return newTasks;
    },
    retry(task: QueueTask<T>) {
      if (task.status !== 'error') return;
      task.status = 'queued';
      task.error = undefined;
      onChange(task);
      drain();
    },
  };
}
```

Create `tests/client/lib/uploadQueue.test.ts` by copying the existing `tests/client/uploadQueue.test.ts` content, updating only the import path to `../../../src/client/lib/uploadQueue`.

- [ ] **Step 5: Port the pure part of `tagColor.ts` and write its test**

Create `src/client/lib/tagColor.ts` (drops `applyTagColor`, which touched `HTMLElement` directly — React components apply the color via inline `style` instead):

```ts
const TAG_COLOR_COUNT = 8;

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return hash % TAG_COLOR_COUNT;
}

export function tagColorVar(tag: string): string {
  return `var(--tag-color-${hashTag(tag)})`;
}
```

Create `tests/client/lib/tagColor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tagColorVar } from '../../../src/client/lib/tagColor';

describe('lib/tagColor', () => {
  it('returns a CSS var reference in the --tag-color-0..7 range', () => {
    const result = tagColorVar('Cliente Acme');
    expect(result).toMatch(/^var\(--tag-color-[0-7]\)$/);
  });

  it('is deterministic for the same tag', () => {
    expect(tagColorVar('Cliente Acme')).toBe(tagColorVar('Cliente Acme'));
  });

  it('does not export applyTagColor (DOM-coupled, replaced by React style props)', async () => {
    const module = await import('../../../src/client/lib/tagColor');
    expect('applyTagColor' in module).toBe(false);
  });
});
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run tests/client/lib`
Expected: PASS (all tests in `tests/client/lib/`)

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/client/types.ts src/client/lib tests/client/lib
git commit -m "feat: port framework-agnostic client logic to lib/"
```

---

## Task 3: UI primitives — Button, Spinner, Field, Card, TagPill, Waveform

**Files:**
- Create: `src/client/ui/Button.tsx`
- Create: `src/client/ui/Spinner.tsx`
- Create: `src/client/ui/Field.tsx`
- Create: `src/client/ui/Card.tsx`
- Create: `src/client/ui/TagPill.tsx`
- Create: `src/client/ui/Waveform.tsx`
- Test: `tests/client/ui/Button.test.tsx`
- Test: `tests/client/ui/Field.test.tsx`
- Test: `tests/client/ui/TagPill.test.tsx`

**Interfaces:**
- Consumes: `tagColorVar` from `../lib/tagColor` (Task 2).
- Produces: `Button({ variant, loading, disabled, children, ...rest }: ButtonProps)` with `ButtonVariant = 'primary' | 'secondary' | 'ghost'`.
- Produces: `Spinner({ size, className }: { size?: 'sm' | 'md' | 'lg'; className?: string })`.
- Produces: `Field({ label, hint, error, inline, children }: FieldProps)`.
- Produces: `Card({ children, className }: { children: React.ReactNode; className?: string })`.
- Produces: `TagPill({ tag, active, onClick }: { tag: string; active?: boolean; onClick?: () => void })`.
- Produces: `Waveform({ className }: { className?: string })`.

- [ ] **Step 1: Write the failing test for `Button`**

Create `tests/client/ui/Button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../../src/client/ui/Button';

describe('Button', () => {
  it('renders children and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Entrar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows a spinner and disables the button when loading', () => {
    render(<Button loading>Entrar</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.queryByText('Entrar')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/ui/Button.test.tsx`
Expected: FAIL — `Cannot find module '../../../src/client/ui/Button'`

- [ ] **Step 3: Implement `Button`**

Create `src/client/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-ctp-mauve text-ctp-mantle hover:enabled:bg-ctp-mauve-dim disabled:bg-ctp-surface2 disabled:text-ctp-overlay0',
  secondary: 'bg-ctp-surface1 text-ctp-text hover:bg-ctp-surface2',
  ghost: 'bg-transparent text-ctp-subtext0 border border-ctp-surface1 hover:text-ctp-text hover:border-ctp-surface2',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[0.9375rem] font-medium
        transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ctp-mauve
        focus-visible:outline-offset-2 disabled:cursor-not-allowed ${loading ? 'cursor-wait' : ''}
        ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      <span className={loading ? 'hidden' : 'contents'}>{children}</span>
      {loading && <Spinner size="sm" />}
    </button>
  );
}
```

- [ ] **Step 4: Implement `Spinner` (needed by `Button`)**

Create `src/client/ui/Spinner.tsx`:

```tsx
export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'w-3 h-3 border-2',
  md: 'w-4 h-4 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block flex-shrink-0 rounded-full border-ctp-surface2 border-t-ctp-mauve
        animate-spin ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
```

- [ ] **Step 5: Run the `Button` test to verify it passes**

Run: `npx vitest run tests/client/ui/Button.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `Field`**

Create `tests/client/ui/Field.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../../../src/client/ui/Field';

describe('Field', () => {
  it('associates the label with its child input via htmlFor/id', () => {
    render(
      <Field label="Usuário" htmlFor="login-user">
        <input id="login-user" />
      </Field>
    );
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
  });

  it('renders an error message when provided', () => {
    render(
      <Field label="Usuário" htmlFor="login-user" error="Campo obrigatório">
        <input id="login-user" />
      </Field>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Campo obrigatório');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/client/ui/Field.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 8: Implement `Field`**

Create `src/client/ui/Field.tsx`:

```tsx
import type { ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  inline?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, inline = false, children }: FieldProps) {
  return (
    <div className={`w-full text-sm text-ctp-subtext1 mb-3 ${inline ? 'flex flex-row items-center gap-2' : 'flex flex-col gap-1.5'}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small className="text-ctp-subtext0 text-xs">{hint}</small>}
      {error && (
        <p role="alert" className="text-ctp-red text-sm m-0">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run the `Field` test to verify it passes**

Run: `npx vitest run tests/client/ui/Field.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 10: Implement `Card` (no test — trivial layout wrapper)**

Create `src/client/ui/Card.tsx`:

```tsx
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-lg p-4 sm:p-6 mb-4 ${className}`}>
      {children}
    </section>
  );
}
```

- [ ] **Step 11: Write the failing test for `TagPill`**

Create `tests/client/ui/TagPill.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPill } from '../../../src/client/ui/TagPill';

describe('TagPill', () => {
  it('renders as static text when no onClick is given', () => {
    render(<TagPill tag="Cliente Acme" />);
    expect(screen.getByText('Cliente Acme')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders as a clickable button when onClick is given', async () => {
    const onClick = vi.fn();
    render(<TagPill tag="Cliente Acme" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Cliente Acme/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `npx vitest run tests/client/ui/TagPill.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 13: Implement `TagPill`**

Create `src/client/ui/TagPill.tsx`:

```tsx
import { tagColorVar } from '../lib/tagColor';

export interface TagPillProps {
  tag: string;
  active?: boolean;
  onClick?: () => void;
}

export function TagPill({ tag, active = false, onClick }: TagPillProps) {
  const style = { '--tag-color': tagColorVar(tag) } as React.CSSProperties;
  const content = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tag-color)]" aria-hidden="true" />
      <span>{tag}</span>
    </>
  );

  const classes = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
    active
      ? 'border-[var(--tag-color)] text-[var(--tag-color)] bg-[color-mix(in_srgb,var(--tag-color)_18%,transparent)]'
      : 'border-ctp-surface1 text-ctp-subtext1'
  }`;

  if (!onClick) {
    return (
      <span style={style} className={classes}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" style={style} onClick={onClick} aria-pressed={active} className={`${classes} cursor-pointer hover:border-ctp-surface2`}>
      {content}
    </button>
  );
}
```

- [ ] **Step 14: Run the `TagPill` test to verify it passes**

Run: `npx vitest run tests/client/ui/TagPill.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 15: Implement `Waveform` (no test — pure decoration, five animated bars)**

Create `src/client/ui/Waveform.tsx`:

```tsx
const BAR_HEIGHTS = ['40%', '80%', '100%', '60%', '30%'];
const BAR_DELAYS = ['-1.1s', '-0.9s', '-0.7s', '-0.5s', '-0.3s'];

export function Waveform({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] h-5 ${className}`} aria-hidden="true">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="w-[3px] rounded-sm bg-ctp-mauve waveform-bar"
          style={{ height, animationDelay: BAR_DELAYS[index] }}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 16: Run all UI primitive tests and typecheck**

Run: `npx vitest run tests/client/ui && npm run typecheck`
Expected: PASS

- [ ] **Step 17: Commit**

```bash
git add src/client/ui tests/client/ui
git commit -m "feat: add Button, Spinner, Field, Card, TagPill, Waveform primitives"
```

---

## Task 4: UI primitive — Modal

**Files:**
- Create: `src/client/ui/Modal.tsx`
- Test: `tests/client/ui/Modal.test.tsx`

**Interfaces:**
- Produces: `Modal({ open, onClose, labelledBy, children }: ModalProps)` where `ModalProps = { open: boolean; onClose?: () => void; labelledBy?: string; children: ReactNode }`. Renders nothing when `open` is `false`. Pressing Escape calls `onClose` if provided. Clicking the backdrop does **not** close it (matches current alert-modal behavior, which only closes via explicit buttons).

- [ ] **Step 1: Write the failing test**

Create `tests/client/ui/Modal.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../../src/client/ui/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false}>
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
  });

  it('renders children when open', () => {
    render(
      <Modal open>
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Conteúdo</p>
      </Modal>
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Conteúdo</p>
      </Modal>
    );
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/ui/Modal.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `Modal`**

Create `src/client/ui/Modal.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  labelledBy?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, labelledBy, children }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-10 flex items-center justify-center bg-[rgba(17,17,27,0.72)] backdrop-blur-sm p-3"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-sm bg-ctp-surface0 border border-ctp-surface1 rounded-xl shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center gap-2"
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/ui/Modal.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/ui/Modal.tsx tests/client/ui/Modal.test.tsx
git commit -m "feat: add Modal primitive"
```

---

## Task 5: UI primitive — Combobox (tag picker)

**Files:**
- Create: `src/client/ui/Combobox.tsx`
- Test: `tests/client/ui/Combobox.test.tsx`

**Interfaces:**
- Consumes: `tagColorVar` from `../lib/tagColor` (Task 2).
- Produces: `Combobox({ id, value, onChange, options, placeholder }: ComboboxProps)` where `ComboboxProps = { id: string; value: string; onChange: (value: string) => void; options: string[]; placeholder?: string }`. Reimplements the keyboard/filtering behavior of the old `tagCombobox.ts` (which was DOM-coupled and is not ported) as a controlled React component: typing filters `options` (case-insensitive substring match), ArrowDown/ArrowUp move a highlighted option, Enter selects the highlighted option, Escape/Tab/blur close the list.

- [ ] **Step 1: Write the failing test**

Create `tests/client/ui/Combobox.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from '../../../src/client/ui/Combobox';

function ControlledCombobox({ options }: { options: string[] }) {
  const [value, setValue] = require('react').useState('');
  return <Combobox id="tag" value={value} onChange={setValue} options={options} placeholder="Ex.: Cliente Acme" />;
}

describe('Combobox', () => {
  it('filters options as the user types', async () => {
    render(<ControlledCombobox options={['Cliente Acme', 'Cliente Beta', 'Interno']} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'acm');
    expect(screen.getByRole('option', { name: /Cliente Acme/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Interno/ })).not.toBeInTheDocument();
  });

  it('selects an option on click and calls onChange', async () => {
    const onChange = vi.fn();
    render(<Combobox id="tag" value="" onChange={onChange} options={['Cliente Acme']} />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /Cliente Acme/ }));
    expect(onChange).toHaveBeenCalledWith('Cliente Acme');
  });

  it('navigates with ArrowDown and selects with Enter', async () => {
    const onChange = vi.fn();
    render(<Combobox id="tag" value="" onChange={onChange} options={['Cliente Acme', 'Cliente Beta']} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('Cliente Acme');
  });

  it('closes the list on Escape', async () => {
    render(<ControlledCombobox options={['Cliente Acme']} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByRole('option', { name: /Cliente Acme/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: /Cliente Acme/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/ui/Combobox.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `Combobox`**

Create `src/client/ui/Combobox.tsx`:

```tsx
import { useMemo, useState, type KeyboardEvent } from 'react';
import { tagColorVar } from '../lib/tagColor';

export interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function Combobox({ id, value, onChange, options, placeholder }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query ? options.filter((tag) => tag.toLowerCase().includes(query)) : options;
  }, [options, value]);

  function open() {
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function select(tag: string) {
    onChange(tag);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') open();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        select(filtered[activeIndex]);
      } else {
        close();
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      close();
    }
  }

  const dotStyle = { '--tag-color': value ? tagColorVar(value) : undefined } as React.CSSProperties;

  return (
    <div className="relative w-full flex items-center gap-2 bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 focus-within:border-ctp-mauve">
      <span
        style={dotStyle}
        className="w-[9px] h-[9px] rounded-full bg-[var(--tag-color,theme(colors.ctp-overlay0))] flex-shrink-0"
        aria-hidden="true"
      />
      <input
        id={id}
        role="combobox"
        type="text"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          open();
        }}
        onFocus={open}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 bg-transparent border-none py-2.5 text-[0.9375rem] text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 right-0 z-10 m-0 p-1 max-h-56 overflow-y-auto list-none bg-ctp-surface0 border border-ctp-surface1 rounded-lg shadow-2xl"
        >
          {filtered.map((tag, index) => (
            <li
              key={tag}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                select(tag);
              }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-[0.9375rem] text-ctp-text cursor-pointer truncate ${
                index === activeIndex ? 'bg-ctp-surface1' : ''
              }`}
            >
              <span
                style={{ '--tag-color': tagColorVar(tag) } as React.CSSProperties}
                className="w-2 h-2 rounded-full bg-[var(--tag-color)] flex-shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{tag}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/ui/Combobox.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/client/ui/Combobox.tsx tests/client/ui/Combobox.test.tsx
git commit -m "feat: add Combobox primitive (tag picker)"
```

---

## Task 6: Alert feature (`AlertContext` + `useAlert`)

**Files:**
- Create: `src/client/features/alert/AlertContext.tsx`
- Test: `tests/client/features/alert/AlertContext.test.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 4), `Button` (Task 3).
- Produces: `AlertProvider({ children }: { children: ReactNode })`, `useAlert(): { showAlert(message: string, options?: AlertOptions): void }` where `AlertOptions = { variant?: 'success' | 'error'; onRetry?: () => void }` (`variant` defaults to `'error'`). Calling `useAlert()` outside an `AlertProvider` throws.

- [ ] **Step 1: Write the failing test**

Create `tests/client/features/alert/AlertContext.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertProvider, useAlert } from '../../../../src/client/features/alert/AlertContext';

function TriggerButton({ onRetry }: { onRetry?: () => void }) {
  const { showAlert } = useAlert();
  return (
    <button onClick={() => showAlert('Não foi possível salvar.', { variant: 'error', onRetry })}>
      Disparar
    </button>
  );
}

describe('AlertContext', () => {
  it('shows the message when showAlert is called', async () => {
    render(
      <AlertProvider>
        <TriggerButton />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    expect(screen.getByText('Não foi possível salvar.')).toBeInTheDocument();
  });

  it('shows a retry button when onRetry is given, and calls it', async () => {
    const onRetry = vi.fn();
    render(
      <AlertProvider>
        <TriggerButton onRetry={onRetry} />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('closes the alert when OK is clicked', async () => {
    render(
      <AlertProvider>
        <TriggerButton />
      </AlertProvider>
    );
    await userEvent.click(screen.getByText('Disparar'));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Não foi possível salvar.')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/alert/AlertContext.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `AlertContext`**

Create `src/client/features/alert/AlertContext.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/alert/AlertContext.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/client/features/alert tests/client/features/alert
git commit -m "feat: add alert feature (AlertContext + useAlert)"
```

---

## Task 7: Auth feature (`AuthContext` + `LoginScreen`)

**Files:**
- Create: `src/client/features/auth/AuthContext.tsx`
- Create: `src/client/features/auth/LoginScreen.tsx`
- Test: `tests/client/features/auth/AuthContext.test.tsx`
- Test: `tests/client/features/auth/LoginScreen.test.tsx`

**Interfaces:**
- Consumes: `getCredentials`, `attemptLogin`, `clearCredentials`, `authFetch` from `../../lib/auth` (Task 2); `Card`, `Field`, `Button`, `Waveform` from `../../ui` (Task 3).
- Produces: `AuthProvider({ children }: { children: ReactNode })`, `useAuth(): AuthContextValue` where `AuthContextValue = { isAuthenticated: boolean; isBootstrapping: boolean; login(user: string, password: string): Promise<boolean>; logout(): void; authFetch: typeof authFetch }`.
- Produces: `LoginScreen()` — renders the login form and calls `useAuth().login`.

- [ ] **Step 1: Write the failing test for `AuthContext`**

Create `tests/client/features/auth/AuthContext.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../../src/client/features/auth/AuthContext';

function Probe() {
  const { isAuthenticated, isBootstrapping, logout } = useAuth();
  if (isBootstrapping) return <p>Carregando…</p>;
  return (
    <div>
      <p>{isAuthenticated ? 'Autenticado' : 'Não autenticado'}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unauthenticated when there are no stored credentials', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Não autenticado')).toBeInTheDocument());
  });

  it('becomes authenticated on mount when stored credentials are valid', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Autenticado')).toBeInTheDocument());
  });

  it('logs out on the auth:unauthorized event', async () => {
    sessionStorage.setItem('transcritor:credentials', btoa('alice:secret'));
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('Autenticado')).toBeInTheDocument());

    window.dispatchEvent(new CustomEvent('auth:unauthorized'));

    await waitFor(() => expect(screen.getByText('Não autenticado')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/auth/AuthContext.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `AuthContext`**

Create `src/client/features/auth/AuthContext.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the `AuthContext` test to verify it passes**

Run: `npx vitest run tests/client/features/auth/AuthContext.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `LoginScreen`**

Create `tests/client/features/auth/LoginScreen.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { LoginScreen } from '../../../../src/client/features/auth/LoginScreen';

describe('LoginScreen', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error message on invalid credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
    render(
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    );
    await userEvent.type(screen.getByLabelText('Usuário'), 'alice');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Usuário ou senha inválidos.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/client/features/auth/LoginScreen.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 7: Implement `LoginScreen`**

Create `src/client/features/auth/LoginScreen.tsx`:

```tsx
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
          <Field label="Senha" htmlFor="login-password">
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
          {error && (
            <p role="alert" className="text-ctp-red text-sm mb-3">
              {error}
            </p>
          )}
          <Button type="submit" loading={isSubmitting} className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Run the `LoginScreen` test to verify it passes**

Run: `npx vitest run tests/client/features/auth/LoginScreen.test.tsx`
Expected: PASS

- [ ] **Step 9: Run all auth tests and typecheck**

Run: `npx vitest run tests/client/features/auth && npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/client/features/auth tests/client/features/auth
git commit -m "feat: add auth feature (AuthContext + LoginScreen)"
```

---

## Task 8: App shell — boot loading, header, `App.tsx`, `main.tsx`

**Files:**
- Create: `src/client/ui/BootLoading.tsx`
- Create: `src/client/ui/Header.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/main.tsx`
- Test: `tests/client/App.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` (Task 7); `AlertProvider` (Task 6); `Waveform`, `Button`, `Spinner` (Task 3).
- Produces: `App()` — top-level component composing `AuthProvider` + `AlertProvider`; renders `BootLoading` while bootstrapping, `LoginScreen` when unauthenticated, otherwise `Header` + a placeholder `<main data-testid="authenticated-app">` (replaced by the real feature composition in Task 12).
- Produces: `Header({ onLogout }: { onLogout: () => void })`.
- `main.tsx` is the Vite entry point that mounts `<App />` into `#root`. It is **not** wired into `index.html` yet — that happens in Task 13's cutover, so the old vanilla app keeps working until then.

- [ ] **Step 1: Write the failing test**

Create `tests/client/App.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/client/App';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the login screen when unauthenticated', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Transcritor' })).toBeInTheDocument());
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
  });

  it('shows the header and authenticated placeholder once logged in', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Usuário')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Usuário'), 'alice');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByTestId('authenticated-app')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/App.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `BootLoading`**

Create `src/client/ui/BootLoading.tsx`:

```tsx
import { Spinner } from './Spinner';

export function BootLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-ctp-base z-20">
      <Spinner size="lg" />
    </div>
  );
}
```

- [ ] **Step 4: Implement `Header`**

Create `src/client/ui/Header.tsx`:

```tsx
import { Waveform } from './Waveform';
import { Button } from './Button';

export function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="flex items-center justify-between py-3 sm:py-4 mb-2">
      <div className="flex items-center gap-2">
        <Waveform />
        <h1 className="font-display text-2xl -tracking-[0.01em]">Transcritor</h1>
      </div>
      <Button variant="ghost" onClick={onLogout}>
        Sair
      </Button>
    </header>
  );
}
```

- [ ] **Step 5: Implement `App`**

Create `src/client/App.tsx`:

```tsx
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
```

- [ ] **Step 6: Implement the Vite entry point**

Create `src/client/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(<App />);
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/client/App.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — note `main.tsx` is not yet referenced by `index.html`, so it doesn't affect the running app.

- [ ] **Step 9: Commit**

```bash
git add src/client/ui/BootLoading.tsx src/client/ui/Header.tsx src/client/App.tsx src/client/main.tsx tests/client/App.test.tsx
git commit -m "feat: add app shell (App, main entry, header, boot loading)"
```

---

## Task 9: Tags + History feature

**Files:**
- Create: `src/client/features/history/useProjectTags.ts`
- Create: `src/client/features/history/HistoryTagFilter.tsx`
- Create: `src/client/features/history/HistoryList.tsx`
- Test: `tests/client/features/history/useProjectTags.test.tsx`
- Test: `tests/client/features/history/HistoryList.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 7, for `authFetch`), `TranscriptionRecord` (Task 2, `src/client/types.ts`), `TagPill` (Task 3).
- Produces: `useProjectTags(refreshKey: number): { tags: string[]; reload(): Promise<void> }` — fetches `GET /api/history/tags` (returns `string[]`); refetches whenever `refreshKey` changes.
- Produces: `HistoryTagFilter({ tags, activeTag, onChange }: { tags: string[]; activeTag: string; onChange: (tag: string) => void })`.
- Produces: `HistoryList({ activeTag, activeRecordId, refreshKey, onSelectRecord, onRecordDeleted }: HistoryListProps)` where `HistoryListProps = { activeTag: string; activeRecordId: number | null; refreshKey: number; onSelectRecord: (record: TranscriptionRecord) => void; onRecordDeleted: (id: number) => void }`. Fetches `GET /api/history` (optionally `?projectTag=<tag>`), refetches when `activeTag` or `refreshKey` changes. Row click calls `onSelectRecord`; delete button calls `DELETE /api/history/:id`, then `onRecordDeleted(id)`, and shows an alert with retry on failure (via `useAlert`).

- [ ] **Step 1: Write the failing test for `useProjectTags`**

Create `tests/client/features/history/useProjectTags.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/history/useProjectTags.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `useProjectTags`**

Create `src/client/features/history/useProjectTags.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/history/useProjectTags.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement `HistoryTagFilter` (no separate test — trivial composition of `TagPill`)**

Create `src/client/features/history/HistoryTagFilter.tsx`:

```tsx
import { TagPill } from '../../ui/TagPill';

export interface HistoryTagFilterProps {
  tags: string[];
  activeTag: string;
  onChange: (tag: string) => void;
}

export function HistoryTagFilter({ tags, activeTag, onChange }: HistoryTagFilterProps) {
  return (
    <div role="group" aria-label="Filtrar por tag" className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        aria-pressed={activeTag === ''}
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
          activeTag === '' ? 'border-ctp-mauve text-ctp-mauve' : 'border-ctp-surface1 text-ctp-subtext1'
        }`}
      >
        Todas
      </button>
      {tags.map((tag) => (
        <TagPill key={tag} tag={tag} active={activeTag === tag} onClick={() => onChange(tag)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write the failing test for `HistoryList`**

Create `tests/client/features/history/HistoryList.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { HistoryList } from '../../../../src/client/features/history/HistoryList';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 1,
  filename: 'reuniao.mp3',
  text: 'Olá mundo',
  projectTag: null,
  durationSeconds: 125,
  withTimestamps: false,
  createdAt: '2026-08-15T12:00:00.000Z',
};

function renderList(overrides: Partial<React.ComponentProps<typeof HistoryList>> = {}) {
  const onSelectRecord = vi.fn();
  const onRecordDeleted = vi.fn();
  render(
    <AuthProvider>
      <AlertProvider>
        <HistoryList
          activeTag=""
          activeRecordId={null}
          refreshKey={0}
          onSelectRecord={onSelectRecord}
          onRecordDeleted={onRecordDeleted}
          {...overrides}
        />
      </AlertProvider>
    </AuthProvider>
  );
  return { onSelectRecord, onRecordDeleted };
}

describe('HistoryList', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state when there are no records', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    renderList();
    expect(await screen.findByText(/Nenhuma transcrição ainda/)).toBeInTheDocument();
  });

  it('renders records and calls onSelectRecord on click', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([RECORD]), { status: 200 }));
    const { onSelectRecord } = renderList();
    const item = await screen.findByText('reuniao.mp3');
    await userEvent.click(item);
    expect(onSelectRecord).toHaveBeenCalledWith(RECORD);
  });

  it('deletes a record and calls onRecordDeleted', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify([RECORD]), { status: 200 }));
    });
    const { onRecordDeleted } = renderList();
    await screen.findByText('reuniao.mp3');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir reuniao.mp3' }));
    await waitFor(() => expect(onRecordDeleted).toHaveBeenCalledWith(1));
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/client/features/history/HistoryList.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 8: Implement `HistoryList`**

Create `src/client/features/history/HistoryList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAlert } from '../alert/AlertContext';
import { Spinner } from '../../ui/Spinner';
import { TagPill } from '../../ui/TagPill';
import type { TranscriptionRecord } from '../../types';

export interface HistoryListProps {
  activeTag: string;
  activeRecordId: number | null;
  refreshKey: number;
  onSelectRecord: (record: TranscriptionRecord) => void;
  onRecordDeleted: (id: number) => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function HistoryList({ activeTag, activeRecordId, refreshKey, onSelectRecord, onRecordDeleted }: HistoryListProps) {
  const { authFetch, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const [records, setRecords] = useState<TranscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadHistory() {
    setIsLoading(true);
    try {
      const url = activeTag ? `/api/history?${new URLSearchParams({ projectTag: activeTag })}` : '/api/history';
      const response = await authFetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar o histórico');
      setRecords((await response.json()) as TranscriptionRecord[]);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Erro ao carregar histórico', {
        onRetry: () => void loadHistory(),
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTag, refreshKey]);

  async function deleteRecord(record: TranscriptionRecord) {
    setDeletingId(record.id);
    try {
      const response = await authFetch(`/api/history/${record.id}`, { method: 'DELETE' });
      if (!response.ok) {
        showAlert(`Não foi possível excluir "${record.filename}".`, { onRetry: () => void deleteRecord(record) });
        return;
      }
      onRecordDeleted(record.id);
      await loadHistory();
    } catch {
      showAlert(`Não foi possível excluir "${record.filename}".`, { onRetry: () => void deleteRecord(record) });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {isLoading && <Spinner size="sm" className="mb-2" />}
      {!isLoading && records.length === 0 && (
        <p className="text-ctp-subtext0 text-[0.9375rem] m-0">
          Nenhuma transcrição ainda — envie um áudio acima para começar.
        </p>
      )}
      <ul className="list-none p-0 m-0">
        {records.map((record) => (
          <li
            key={record.id}
            className={`flex items-center justify-between gap-2 border-b border-ctp-surface1 last:border-none ${
              record.id === activeRecordId ? 'bg-ctp-surface1/40' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectRecord(record)}
              className="flex-1 flex flex-col items-start gap-0.5 bg-transparent border-none py-2 text-left cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5 flex-wrap text-ctp-text text-[0.9375rem]">
                {record.filename}
                {record.projectTag && <TagPill tag={record.projectTag} />}
                {record.withTimestamps && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-ctp-mauve/15 text-ctp-mauve text-[0.6875rem] font-medium">
                    Com tempo
                  </span>
                )}
              </span>
              <span className="text-ctp-subtext0 text-[0.8125rem] font-mono">
                {formatDuration(record.durationSeconds)} · {new Date(record.createdAt).toLocaleString('pt-BR')}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Excluir ${record.filename}`}
              disabled={deletingId === record.id}
              onClick={(event) => {
                event.stopPropagation();
                void deleteRecord(record);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-ctp-overlay0 hover:bg-ctp-red/10 hover:text-ctp-red disabled:opacity-60"
            >
              {deletingId === record.id ? <Spinner size="sm" /> : '✕'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/history`
Expected: PASS (all tests)

- [ ] **Step 10: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/client/features/history tests/client/features/history
git commit -m "feat: add tags + history feature"
```

---

## Task 10: Upload feature

**Files:**
- Create: `src/client/features/upload/useUploadQueueFeature.ts`
- Create: `src/client/features/upload/UploadCard.tsx`
- Test: `tests/client/features/upload/useUploadQueueFeature.test.tsx`
- Test: `tests/client/features/upload/UploadCard.test.tsx`

**Interfaces:**
- Consumes: `createUploadQueue`, `QueueTask` (Task 2, `lib/uploadQueue`), `useAuth` (Task 7), `TranscriptionRecord` (Task 2), `LANGUAGES`/`LANGUAGE_LABELS` from `../../../shared/languages` (existing, unchanged), `Combobox` (Task 5), `Button` (Task 3).
- Produces: `UploadPayload = { file: File; projectTag: string | null; withTimestamps: boolean; language: string; record?: TranscriptionRecord }`.
- Produces: `useUploadQueueFeature(onRecordCreated: (record: TranscriptionRecord) => void): { tasks: QueueTask<UploadPayload>[]; enqueue(payloads: UploadPayload[]): void; retry(task: QueueTask<UploadPayload>): void }` — wraps `createUploadQueue` with concurrency 3; `execute` posts to `POST /api/transcribe` as `multipart/form-data` (fields: `audio`, `withTimestamps`, `language`, `projectTag?`), and on success calls `onRecordCreated` with the parsed `TranscriptionRecord`.
- Produces: `UploadCard({ tags, onRecordCreated, onOpenRecord }: { tags: string[]; onRecordCreated: (record: TranscriptionRecord) => void; onOpenRecord: (record: TranscriptionRecord) => void })`.

- [ ] **Step 1: Write the failing test for `useUploadQueueFeature`**

Create `tests/client/features/upload/useUploadQueueFeature.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { useUploadQueueFeature } from '../../../../src/client/features/upload/useUploadQueueFeature';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 7,
  filename: 'audio.mp3',
  text: 'texto',
  projectTag: null,
  durationSeconds: 10,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

let enqueueRef: ((files: File[]) => void) | undefined;

function Probe({ onRecordCreated }: { onRecordCreated: (record: TranscriptionRecord) => void }) {
  const { tasks, enqueue } = useUploadQueueFeature(onRecordCreated);
  enqueueRef = (files) =>
    enqueue(files.map((file) => ({ file, projectTag: null, withTimestamps: false, language: 'pt' })));
  return <p>{tasks.map((task) => `${task.value.file.name}:${task.status}`).join(', ')}</p>;
}

describe('useUploadQueueFeature', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/transcribe and calls onRecordCreated on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onRecordCreated = vi.fn();
    render(
      <AuthProvider>
        <Probe onRecordCreated={onRecordCreated} />
      </AuthProvider>
    );

    act(() => {
      enqueueRef?.([new File(['data'], 'audio.mp3', { type: 'audio/mpeg' })]);
    });

    await waitFor(() => expect(screen.getByText('audio.mp3:success')).toBeInTheDocument());
    expect(onRecordCreated).toHaveBeenCalledWith(RECORD);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/upload/useUploadQueueFeature.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `useUploadQueueFeature`**

Create `src/client/features/upload/useUploadQueueFeature.ts`:

```ts
import { useState } from 'react';
import { createUploadQueue, type QueueTask } from '../../lib/uploadQueue';
import { useAuth } from '../auth/AuthContext';
import type { TranscriptionRecord } from '../../types';

export interface UploadPayload {
  file: File;
  projectTag: string | null;
  withTimestamps: boolean;
  language: string;
  record?: TranscriptionRecord;
}

export function useUploadQueueFeature(onRecordCreated: (record: TranscriptionRecord) => void) {
  const { authFetch } = useAuth();
  const [tasks, setTasks] = useState<QueueTask<UploadPayload>[]>([]);

  const [queue] = useState(() =>
    createUploadQueue<UploadPayload>(
      3,
      async (payload) => {
        const formData = new FormData();
        formData.append('audio', payload.file);
        formData.append('withTimestamps', String(payload.withTimestamps));
        formData.append('language', payload.language);
        if (payload.projectTag) formData.append('projectTag', payload.projectTag);
        const response = await authFetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Erro ao transcrever');
        payload.record = data as TranscriptionRecord;
        onRecordCreated(payload.record);
      },
      (updated) => {
        setTasks((current) => {
          const index = current.findIndex((task) => task.id === updated.id);
          if (index === -1) return [...current, { ...updated }];
          const next = [...current];
          next[index] = { ...updated };
          return next;
        });
      }
    )
  );

  return {
    tasks,
    enqueue(payloads: UploadPayload[]) {
      queue.enqueue(payloads);
    },
    retry(task: QueueTask<UploadPayload>) {
      queue.retry(task);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/upload/useUploadQueueFeature.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `UploadCard`**

Create `tests/client/features/upload/UploadCard.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { UploadCard } from '../../../../src/client/features/upload/UploadCard';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 1,
  filename: 'audio.mp3',
  text: '',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('UploadCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('enables the transcribe button once a file is selected, and uploads on click', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onRecordCreated = vi.fn();
    render(
      <AuthProvider>
        <UploadCard tags={[]} onRecordCreated={onRecordCreated} onOpenRecord={vi.fn()} />
      </AuthProvider>
    );

    const button = screen.getByRole('button', { name: 'Transcrever' });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText(/Arraste áudios ou vídeos/i, { selector: 'input' });
    const file = new File(['data'], 'audio.mp3', { type: 'audio/mpeg' });
    await userEvent.upload(input, file);

    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(onRecordCreated).toHaveBeenCalledWith(RECORD));
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/client/features/upload/UploadCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 7: Implement `UploadCard`**

Create `src/client/features/upload/UploadCard.tsx`:

```tsx
import { useRef, useState, type DragEvent } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { Combobox } from '../../ui/Combobox';
import { LANGUAGES, LANGUAGE_LABELS } from '../../../shared/languages';
import { useUploadQueueFeature, type UploadPayload } from './useUploadQueueFeature';
import type { TranscriptionRecord } from '../../types';

export interface UploadCardProps {
  tags: string[];
  onRecordCreated: (record: TranscriptionRecord) => void;
  onOpenRecord: (record: TranscriptionRecord) => void;
}

function normalizeProjectTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function UploadCard({ tags, onRecordCreated, onOpenRecord }: UploadCardProps) {
  const { tasks, enqueue, retry } = useUploadQueueFeature(onRecordCreated);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [withTimestamps, setWithTimestamps] = useState(false);
  const [language, setLanguage] = useState('pt');
  const [projectTag, setProjectTag] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    setSelectedFiles(Array.from(event.dataTransfer.files));
  }

  function handleTranscribe() {
    if (selectedFiles.length === 0) return;
    const payloads: UploadPayload[] = selectedFiles.map((file) => ({
      file,
      projectTag: normalizeProjectTag(projectTag),
      withTimestamps,
      language,
    }));
    enqueue(payloads);
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const fileSummary =
    selectedFiles.length === 1 ? selectedFiles[0].name : selectedFiles.length > 1 ? `${selectedFiles.length} arquivos selecionados` : '';

  return (
    <Card>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 min-h-[140px] border-2 border-dashed rounded-lg text-center p-4 mb-3 cursor-pointer transition-colors ${
          isDragOver || selectedFiles.length > 0 ? 'border-ctp-mauve bg-ctp-mauve/5' : 'border-ctp-surface2 text-ctp-subtext0'
        }`}
      >
        {selectedFiles.length === 0 ? (
          <span>Arraste áudios ou vídeos aqui ou clique para escolher</span>
        ) : (
          <span className="flex flex-col items-center gap-1">
            <span className="text-ctp-text text-[0.9375rem] break-all">{fileSummary}</span>
            <small className="text-ctp-subtext0 text-[0.8125rem]">Clique para trocar o arquivo</small>
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
        />
      </label>
      <p className="text-ctp-subtext0 text-sm mb-3">
        Em vídeos, somente o áudio é extraído. Dependendo do tamanho do arquivo, o upload e a transcrição podem demorar
        alguns minutos.
      </p>
      <div className="flex flex-col gap-3 mb-3">
        <label className="flex items-start gap-2 text-[0.9375rem] cursor-pointer">
          <input
            type="checkbox"
            checked={withTimestamps}
            onChange={(event) => setWithTimestamps(event.target.checked)}
            className="mt-0.5 w-4 h-4 accent-ctp-mauve cursor-pointer"
          />
          <span>
            Adicionar tempo às falas
            <small className="block text-ctp-subtext0 text-[0.8125rem] font-normal mt-0.5">
              Adiciona o tempo de cada trecho falado ao texto. Isso usa outro modelo de transcrição e pode reduzir um
              pouco a qualidade — se notar isso, tente novamente sem marcar esta opção.
            </small>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <span>Idioma</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2 text-[0.9375rem]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span>Tag</span>
          <Combobox id="upload-project-tag" value={projectTag} onChange={setProjectTag} options={tags} placeholder="Ex.: Cliente Acme" />
        </label>
      </div>
      <Button onClick={handleTranscribe} disabled={selectedFiles.length === 0}>
        Transcrever
      </Button>
      {tasks.length > 0 && (
        <ul className="list-none p-0 mt-3 border-t border-ctp-surface1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 py-2 border-b border-ctp-surface1">
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="truncate text-ctp-text text-[0.9375rem]">{task.value.file.name}</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-xs ${
                    task.status === 'error' ? 'text-ctp-red' : task.status === 'success' ? 'text-ctp-green' : 'text-ctp-subtext0'
                  }`}
                >
                  {task.status === 'processing' && <Spinner size="sm" />}
                  {task.status === 'queued' && 'Aguardando'}
                  {task.status === 'processing' && 'Transcrevendo…'}
                  {task.status === 'success' && 'Concluído'}
                  {task.status === 'error' && (task.error ?? 'Erro ao transcrever')}
                </span>
              </div>
              {task.status === 'error' && (
                <Button variant="ghost" onClick={() => retry(task)}>
                  Tentar novamente
                </Button>
              )}
              {task.status === 'success' && task.value.record && (
                <Button variant="ghost" onClick={() => onOpenRecord(task.value.record!)}>
                  Abrir
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/upload`
Expected: PASS (all tests)

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/client/features/upload tests/client/features/upload
git commit -m "feat: add upload feature"
```

---

## Task 11: Editor feature

**Files:**
- Create: `src/client/features/editor/useRecordAutosave.ts`
- Create: `src/client/features/editor/ResultEditor.tsx`
- Test: `tests/client/features/editor/useRecordAutosave.test.tsx`
- Test: `tests/client/features/editor/ResultEditor.test.tsx`

**Interfaces:**
- Consumes: `createAutosave`, `AutosaveStatus` (Task 2, `lib/autosave`), `useAuth` (Task 7), `TranscriptionRecord`/`TranscriptionChanges` (Task 2), `useAlert` (Task 6), `Field`, `Combobox` (Tasks 3/5).
- Produces: `useRecordAutosave(record: TranscriptionRecord, onSaved: () => void): { draft: TranscriptionChanges; status: AutosaveStatus; updateField<K extends keyof TranscriptionChanges>(key: K, value: TranscriptionChanges[K]): void }` — one instance per open record; schedules a `PATCH /api/history/:id` 700ms after each `updateField` call; on save error, shows an alert with retry via `useAlert`; on save success, calls `onSaved`.
- Produces: `ResultEditor({ record, tags, onSaved }: { record: TranscriptionRecord; tags: string[]; onSaved: () => void })`.

- [ ] **Step 1: Write the failing test for `useRecordAutosave`**

Create `tests/client/features/editor/useRecordAutosave.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { useRecordAutosave } from '../../../../src/client/features/editor/useRecordAutosave';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 3,
  filename: 'nota.mp3',
  text: 'texto original',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

let updateFieldRef: ((text: string) => void) | undefined;

function Probe({ onSaved }: { onSaved: () => void }) {
  const { draft, status, updateField } = useRecordAutosave(RECORD, onSaved);
  updateFieldRef = (text) => updateField('text', text);
  return (
    <p>
      {draft.text}:{status}
    </p>
  );
}

describe('useRecordAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('schedules a PATCH 700ms after updateField and reports saved status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 }));
    const onSaved = vi.fn();
    render(
      <AuthProvider>
        <AlertProvider>
          <Probe onSaved={onSaved} />
        </AlertProvider>
      </AuthProvider>
    );

    act(() => {
      updateFieldRef?.('texto novo');
    });
    expect(screen.getByText('texto novo:saved')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/history/3');
    expect(init?.method).toBe('PATCH');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/editor/useRecordAutosave.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `useRecordAutosave`**

Create `src/client/features/editor/useRecordAutosave.ts`:

```ts
import { useState } from 'react';
import { createAutosave, type AutosaveStatus } from '../../lib/autosave';
import { useAuth } from '../auth/AuthContext';
import { useAlert } from '../alert/AlertContext';
import type { TranscriptionChanges, TranscriptionRecord } from '../../types';

export function useRecordAutosave(record: TranscriptionRecord, onSaved: () => void) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [draft, setDraft] = useState<TranscriptionChanges>({
    filename: record.filename,
    text: record.text,
    projectTag: record.projectTag,
  });
  const [status, setStatus] = useState<AutosaveStatus>('saved');

  const [autosave] = useState(() => {
    let hasAlertedSaveError = false;
    return createAutosave<TranscriptionChanges>(
      700,
      async (changes) => {
        const response = await authFetch(`/api/history/${record.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar');
        onSaved();
      },
      (nextStatus) => {
        setStatus(nextStatus);
        if (nextStatus === 'saved') {
          hasAlertedSaveError = false;
        } else if (nextStatus === 'error' && !hasAlertedSaveError) {
          hasAlertedSaveError = true;
          showAlert(`Não foi possível salvar as alterações de "${draft.filename}".`, {
            onRetry: () => autosave.retry(),
          });
        }
      }
    );
  });

  function updateField<K extends keyof TranscriptionChanges>(key: K, value: TranscriptionChanges[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      autosave.schedule(next);
      return next;
    });
  }

  return { draft, status, updateField };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/editor/useRecordAutosave.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `ResultEditor`**

Create `tests/client/features/editor/ResultEditor.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../../src/client/features/alert/AlertContext';
import { ResultEditor } from '../../../../src/client/features/editor/ResultEditor';
import type { TranscriptionRecord } from '../../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 4,
  filename: 'reuniao.mp3',
  text: 'uma duas',
  projectTag: null,
  durationSeconds: 5,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('ResultEditor', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(RECORD), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the word count for the initial text', () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <ResultEditor record={RECORD} tags={[]} onSaved={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );
    expect(screen.getByText('2 palavras')).toBeInTheDocument();
  });

  it('copies the text to the clipboard on Copiar click', async () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <ResultEditor record={RECORD} tags={[]} onSaved={vi.fn()} />
        </AlertProvider>
      </AuthProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('uma duas');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run tests/client/features/editor/ResultEditor.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 7: Implement `ResultEditor`**

Create `src/client/features/editor/ResultEditor.tsx`:

```tsx
import { Card } from '../../ui/Card';
import { Field } from '../../ui/Field';
import { Button } from '../../ui/Button';
import { Combobox } from '../../ui/Combobox';
import { useAlert } from '../alert/AlertContext';
import { useRecordAutosave } from './useRecordAutosave';
import type { TranscriptionRecord } from '../../types';

export interface ResultEditorProps {
  record: TranscriptionRecord;
  tags: string[];
  onSaved: () => void;
}

function normalizeProjectTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function ResultEditor({ record, tags, onSaved }: ResultEditorProps) {
  const { showAlert } = useAlert();
  const { draft, updateField } = useRecordAutosave(record, onSaved);

  const wordCount = draft.text.trim().match(/\S+/g)?.length ?? 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft.text);
      showAlert('Copiado para a área de transferência.', { variant: 'success' });
    } catch {
      showAlert('Não foi possível copiar para a área de transferência.');
    }
  }

  function handleDownload() {
    const blob = new Blob([draft.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(draft.filename || 'transcricao').replace(/\.[^.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <h2 className="font-display text-lg mb-3">Resultado</h2>
      <Field label="Nome da transcrição" htmlFor="result-filename">
        <input
          id="result-filename"
          type="text"
          value={draft.filename}
          onChange={(event) => updateField('filename', event.target.value)}
          className="w-full bg-ctp-mantle border border-ctp-surface1 rounded-lg px-3 py-2.5 text-[0.9375rem]"
        />
      </Field>
      <Field label="Tag" htmlFor="result-project-tag">
        <Combobox
          id="result-project-tag"
          value={draft.projectTag ?? ''}
          onChange={(value) => updateField('projectTag', normalizeProjectTag(value))}
          options={tags}
          placeholder="Sem tag"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label htmlFor="result-text" className="inline-flex items-center gap-1.5 text-ctp-subtext1 text-sm">
          Transcrição
        </label>
        <span className="text-ctp-overlay0 font-mono text-xs">
          {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
        </span>
      </div>
      <textarea
        id="result-text"
        placeholder="Edite o texto da transcrição aqui…"
        value={draft.text}
        onChange={(event) => updateField('text', event.target.value)}
        className="block w-full min-h-[220px] max-h-[60vh] resize-y bg-ctp-mantle text-ctp-text border border-ctp-surface1 rounded-lg p-3 text-[0.9375rem] leading-relaxed focus-visible:outline-none focus-visible:border-ctp-mauve"
      />
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" onClick={handleCopy}>
          Copiar
        </Button>
        <Button variant="secondary" onClick={handleDownload}>
          Baixar
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/client/features/editor`
Expected: PASS (all tests)

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/client/features/editor tests/client/features/editor
git commit -m "feat: add editor feature"
```

---

## Task 12: `MainApp` — wire upload, editor, history and tags together

**Files:**
- Create: `src/client/features/MainApp.tsx`
- Modify: `src/client/App.tsx`
- Test: `tests/client/features/MainApp.test.tsx`
- Modify: `tests/client/App.test.tsx`

**Interfaces:**
- Consumes: `UploadCard` (Task 10), `ResultEditor` (Task 11), `HistoryList`, `HistoryTagFilter`, `useProjectTags` (Task 9), `Card` (Task 3).
- Produces: `MainApp()` — owns `activeRecord: TranscriptionRecord | null`, `activeTag: string`, and a `refreshKey: number` bumped whenever a record is created/edited/deleted (drives both `useProjectTags` and `HistoryList` refetches). Passes `onRecordCreated`/`onSaved` callbacks that both set `activeRecord` and bump `refreshKey`; passes `onRecordDeleted` that clears `activeRecord` if it matches and bumps `refreshKey`.
- `App.tsx`'s `AppShell` renders `<MainApp />` instead of the empty placeholder `<main data-testid="authenticated-app" />`.

- [ ] **Step 1: Write the failing test for `MainApp`**

Create `tests/client/features/MainApp.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../../src/client/features/auth/AuthContext';
import { AlertProvider } from '../../../src/client/features/alert/AlertContext';
import { MainApp } from '../../../src/client/features/MainApp';
import type { TranscriptionRecord } from '../../../src/client/types';

const RECORD: TranscriptionRecord = {
  id: 9,
  filename: 'chamada.mp3',
  text: 'conteudo',
  projectTag: null,
  durationSeconds: 12,
  withTimestamps: false,
  createdAt: '2026-08-15T00:00:00.000Z',
};

describe('MainApp', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/history/tags')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        if (url.includes('/api/history')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        return Promise.resolve(new Response(JSON.stringify(RECORD), { status: 200 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the editor for a record created by an upload', async () => {
    render(
      <AuthProvider>
        <AlertProvider>
          <MainApp />
        </AlertProvider>
      </AuthProvider>
    );

    const input = screen.getByLabelText(/Arraste áudios ou vídeos/i, { selector: 'input' });
    await userEvent.upload(input, new File(['data'], 'chamada.mp3', { type: 'audio/mpeg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Transcrever' }));

    await waitFor(() => expect(screen.getByLabelText('Nome da transcrição')).toHaveValue('chamada.mp3'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/features/MainApp.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `MainApp`**

Create `src/client/features/MainApp.tsx`:

```tsx
import { useState } from 'react';
import { Card } from '../ui/Card';
import { UploadCard } from './upload/UploadCard';
import { ResultEditor } from './editor/ResultEditor';
import { HistoryList } from './history/HistoryList';
import { HistoryTagFilter } from './history/HistoryTagFilter';
import { useProjectTags } from './history/useProjectTags';
import type { TranscriptionRecord } from '../types';

export function MainApp() {
  const [activeRecord, setActiveRecord] = useState<TranscriptionRecord | null>(null);
  const [activeTag, setActiveTag] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { tags } = useProjectTags(refreshKey);

  function bumpRefresh() {
    setRefreshKey((key) => key + 1);
  }

  function handleRecordCreated(record: TranscriptionRecord) {
    setActiveRecord(record);
    bumpRefresh();
  }

  function handleRecordSaved() {
    bumpRefresh();
  }

  function handleRecordDeleted(id: number) {
    setActiveRecord((current) => (current?.id === id ? null : current));
    bumpRefresh();
  }

  function handleTagChange(tag: string) {
    if (tags.length > 0 && tag && !tags.includes(tag)) return;
    setActiveTag(tag);
  }

  return (
    <div>
      <UploadCard tags={tags} onRecordCreated={handleRecordCreated} onOpenRecord={setActiveRecord} />
      {activeRecord && <ResultEditor key={activeRecord.id} record={activeRecord} tags={tags} onSaved={handleRecordSaved} />}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-display text-lg">Histórico</h2>
          <HistoryTagFilter tags={tags} activeTag={activeTag} onChange={handleTagChange} />
        </div>
        <HistoryList
          activeTag={activeTag}
          activeRecordId={activeRecord?.id ?? null}
          refreshKey={refreshKey}
          onSelectRecord={setActiveRecord}
          onRecordDeleted={handleRecordDeleted}
        />
      </Card>
    </div>
  );
}
```

Note: the `<Spinner>` import above is unused if the loading state stays inside `HistoryList` — remove the `Spinner` import from `MainApp.tsx` since it is not referenced (it is already used inside `HistoryList`). Keep only the imports actually used: `Card`, `UploadCard`, `ResultEditor`, `HistoryList`, `HistoryTagFilter`, `useProjectTags`, `useState`, and the `TranscriptionRecord` type.

- [ ] **Step 4: Wire `MainApp` into `App.tsx`**

Modify `src/client/App.tsx` — replace the placeholder `<main>` with `<MainApp />`:

```tsx
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AlertProvider } from './features/alert/AlertContext';
import { LoginScreen } from './features/auth/LoginScreen';
import { MainApp } from './features/MainApp';
import { BootLoading } from './ui/BootLoading';
import { Header } from './ui/Header';

function AppShell() {
  const { isAuthenticated, isBootstrapping, logout } = useAuth();

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
```

- [ ] **Step 5: Update `tests/client/App.test.tsx`**

Modify the second test in `tests/client/App.test.tsx` — the placeholder `data-testid="authenticated-app"` no longer exists, so assert on real `MainApp` content instead, and mock the extra endpoints `MainApp` now calls on mount:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/client/App';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/history/tags')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        if (url.includes('/api/history')) return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        return Promise.resolve(new Response(null, { status: 200 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the login screen when unauthenticated', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Transcritor' })).toBeInTheDocument());
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
  });

  it('shows the header and main app once logged in', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText('Usuário')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('Usuário'), 'alice');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Histórico' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/client/features/MainApp.test.tsx tests/client/App.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 7: Run the full client test suite and typecheck**

Run: `npx vitest run tests/client && npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/client/features/MainApp.tsx src/client/App.tsx tests/client/features/MainApp.test.tsx tests/client/App.test.tsx
git commit -m "feat: wire upload, editor, history and tags into MainApp"
```

---

## Task 13: Cutover — remove the legacy vanilla client, wire up the new entry point

**Files:**
- Modify: `src/client/index.html`
- Delete: `src/client/main.ts`
- Delete: `src/client/style.css`
- Delete: `src/client/auth.ts`
- Delete: `src/client/autosave.ts`
- Delete: `src/client/uploadQueue.ts`
- Delete: `src/client/tagCombobox.ts`
- Delete: `src/client/tagColor.ts`
- Delete: `tests/client/autosave.test.ts` (superseded by `tests/client/lib/autosave.test.ts`)
- Delete: `tests/client/uploadQueue.test.ts` (superseded by `tests/client/lib/uploadQueue.test.ts`)
- Delete: `tests/client/smoke.test.tsx` (Task 1 scaffolding check, no longer needed)

**Interfaces:** None — this task only removes dead code and repoints the HTML entry.

- [ ] **Step 1: Confirm no remaining references to the legacy files**

Run: `grep -rn "from '\./auth'\|from '\./autosave'\|from '\./uploadQueue'\|from '\./tagCombobox'\|from '\./tagColor'" src/client tests/client --include="*.ts" --include="*.tsx" | grep -v "/lib/"`
Expected: no output. If any file under `src/client/lib/`, `src/client/features/`, or `src/client/ui/` shows up, fix its import to point at `../lib/...` (or the correct relative path) before continuing — every new module must depend on `lib/`, not the legacy top-level files.

- [ ] **Step 2: Rewrite the HTML entry point**

Modify `src/client/index.html` — replace its entire body with the React shell (keep the font `<link>` tags, drop everything else since React now owns all of it):

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Transcritor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Delete the legacy vanilla client files**

```bash
git rm src/client/main.ts src/client/style.css src/client/auth.ts \
  src/client/autosave.ts src/client/uploadQueue.ts src/client/tagCombobox.ts \
  src/client/tagColor.ts
git rm tests/client/autosave.test.ts tests/client/uploadQueue.test.ts tests/client/smoke.test.tsx
```

(If `tests/client/auth.test.ts` also existed prior to this migration, remove it too, since `tests/client/lib/auth.test.ts` supersedes it — check with `git status` before removing anything not listed above.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — every test in `tests/client/` (now only the new React-based tests) and `tests/server/` passes.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no dangling references to deleted files.

- [ ] **Step 6: Build the production bundle**

Run: `npm run build`
Expected: succeeds, producing `dist/client/index.html` and bundled JS/CSS.

- [ ] **Step 7: Manual smoke check in the browser**

Run: `npm run dev` (starts both the Express server and Vite dev server), open the printed Vite URL, and verify by hand:
- Login screen appears, rejects wrong credentials with an inline error, accepts correct ones.
- Dropping/selecting a file enables "Transcrever"; after a successful transcription the editor opens with the new record.
- Editing the transcription text/filename/tag autosaves (no explicit save button) and the history list picks up the change after a moment.
- Deleting a history item removes it and closes the editor if it was the open record.
- Tag filter chips in "Histórico" filter the list.
- Resize the window to a phone width (~375px) and confirm the layout stays usable (no horizontal scroll, buttons are tappable).
- "Sair" logs out and returns to the login screen.

- [ ] **Step 8: Commit**

```bash
git add src/client/index.html
git commit -m "feat: cut over to the React client, remove legacy vanilla frontend"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (Task 1), lib/ port (Task 2), UI kit (Tasks 3-5), alert handling (Task 6), auth flow (Task 7), app shell (Task 8), tags/history (Task 9), upload (Task 10), editor/autosave (Task 11), integration (Task 12), and the big-bang cutover (Task 13) each map to a spec section. Responsive/touch-friendly layout is addressed via Tailwind's default mobile-first classes throughout every component (no separate task needed — it's a property of how each component was built, not a bolt-on). No dark mode, no routing, no external state library, and no Capacitor code appear anywhere in the plan, matching the spec's non-goals.
- **Type consistency:** `TranscriptionRecord`/`TranscriptionChanges` (Task 2) are the only record types, reused verbatim through Tasks 9-12. `AutosaveStatus` and `QueueTask<T>` (Task 2) flow unchanged into Tasks 10-11. `AuthContextValue`, `AlertOptions`, `ComboboxProps`, `ButtonProps` are each defined once (Tasks 3-7) and consumed with matching shapes everywhere they're used later.
- **Placeholder scan:** every step has runnable code and concrete commands; no "TBD"/"similar to Task N" placeholders remain.
