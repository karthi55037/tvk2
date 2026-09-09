'use client';

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshPromise = null), 1000);
      });
  }
  return refreshPromise;
}

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
};

/** API client with automatic session refresh on 401 and friendly error surfaces (§43). */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: opts.formData ? undefined : { 'Content-Type': 'application/json' },
      body: opts.formData ? opts.formData : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiClientError('NETWORK', 'No internet connection. Please check your network and try again.', 0);
  }

  if (res.status === 401 && !retried && !path.startsWith('/api/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, opts, true);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } })?.error;
    throw new ApiClientError(err?.code || 'ERROR', err?.message || friendlyStatus(res.status), res.status);
  }
  return data as T;
}

function friendlyStatus(status: number): string {
  switch (status) {
    case 400: return 'Invalid request. Please check the form and try again.';
    case 401: return 'Your session has expired. Please sign in again.';
    case 403: return 'You do not have permission for this action.';
    case 404: return 'Not found.';
    case 409: return 'Conflict — this may already exist.';
    case 413: return 'The file is too large.';
    case 429: return 'Too many requests. Please slow down and try again shortly.';
    case 0: return 'No internet connection.';
    default: return 'Something went wrong. Please try again.';
  }
}

/** Small fetch-event bus for real-time refresh hints from the SSE stream. */
export function onRealtime(topic: string, cb: () => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as string | undefined;
    if (!detail || detail === topic) cb();
  };
  window.addEventListener('cb:refresh', handler);
  return () => window.removeEventListener('cb:refresh', handler);
}
