'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { ToastProvider, useToast } from '@/components/ui';
import type { Role } from '@/lib/constants';

export type SessionUser = {
  id: string;
  username: string;
  regNo: string | null;
  role: Role;
  name: string;
  mustChangePassword: boolean;
};

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
  unread: number;
  bumpUnread: (delta: number) => void;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, reload: async () => {}, logout: async () => {}, unread: 0, bumpUnread: () => {} });
export const useAuth = () => useContext(Ctx);

function Inner({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const esRef = useRef<EventSource | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ user: SessionUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* best effort */
    }
    setUser(null);
    esRef.current?.close();
    router.replace('/login');
  }, [router]);

  // Real-time stream: notifications + refresh hints (§38)
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const es = new EventSource('/api/realtime');
    esRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type: string; topic?: string; payload?: { title?: string; body?: string } };
        if (data.type === 'notification') {
          setUnread((n) => n + 1);
          if (data.payload?.title) toast.push('info', data.payload.title);
          window.dispatchEvent(new CustomEvent('cb:notification'));
        } else if (data.type === 'chat') {
          window.dispatchEvent(new CustomEvent('cb:refresh', { detail: data.topic }));
        } else if (data.type === 'refresh' && data.topic && data.topic !== 'connected') {
          window.dispatchEvent(new CustomEvent('cb:refresh', { detail: data.topic }));
        }
      } catch {
        /* ignore malformed */
      }
    };
    return () => es.close();
  }, [user, toast]);

  // load unread count on mount + on notification events
  useEffect(() => {
    if (!user) return;
    api<{ notifications: { readAt: string | null }[] }>('/api/notifications')
      .then((r) => setUnread(r.notifications.filter((n) => !n.readAt).length))
      .catch(() => {});
    const onNotif = () => void 0;
    window.addEventListener('cb:notification', onNotif);
    return () => window.removeEventListener('cb:notification', onNotif);
  }, [user]);

  const bumpUnread = useCallback((delta: number) => setUnread((n) => Math.max(0, n + delta)), []);

  // Auth routing guards
  useEffect(() => {
    if (loading) return;
    const isPublic = pathname === '/login' || pathname.startsWith('/change-password');
    if (!user && !isPublic) router.replace('/login');
    if (user && pathname === '/login') router.replace('/home');
    if (user?.mustChangePassword && !pathname.startsWith('/change-password')) router.replace('/change-password');
  }, [user, loading, pathname, router]);

  return <Ctx.Provider value={{ user, loading, reload, logout, unread, bumpUnread }}>{children}</Ctx.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Inner>{children}</Inner>
    </ToastProvider>
  );
}

// ---------------------------------------------------------------- theme

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);
  return (
    <button
      aria-label="Toggle dark mode"
      className={className}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('cb-theme', next ? 'dark' : 'light');
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

export function initTheme() {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem('cb-theme');
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefers)) document.documentElement.classList.add('dark');
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
