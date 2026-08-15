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
