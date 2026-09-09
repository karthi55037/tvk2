'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Button, Card, Loading, useToast } from '@/components/ui';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_LABELS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/dates';
import { BellRing } from 'lucide-react';

type Notif = { id: string; category: string; title: string; body: string; readAt: string | null; createdAt: string };

export default function NotificationsPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [pushState, setPushState] = useState<'unsupported' | 'off' | 'on' | 'noperm'>('unsupported');

  const load = useCallback(() => {
    api<{ preferences: Record<string, boolean> }>('/api/notifications/preferences').then((r) => setPrefs(r.preferences)).catch(() => setPrefs({}));
    api<{ notifications: Notif[] }>('/api/notifications').then((r) => setNotifications(r.notifications)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    // Detect push state only — permission prompts must be triggered by a user gesture (the Enable button), never on mount.
    if (typeof window === 'undefined' || !('PushManager' in window) || !('serviceWorker' in navigator) || typeof Notification === 'undefined') {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushState('noperm');
      return;
    }
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setPushState(Notification.permission === 'granted' && sub ? 'on' : 'off');
      })
      .catch(() => setPushState('unsupported'));
  }, []);

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission(); // user-gesture driven
      if (perm !== 'granted') {
        setPushState(perm === 'denied' ? 'noperm' : 'off');
        toast.push('error', 'Notification permission was not granted');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await api<{ publicKey: string | null }>('/api/push');
      if (!keyRes.publicKey) {
        toast.push('error', 'Push is not configured on the server');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api('/api/push', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
      setPushState('on');
      toast.push('success', 'Push notifications enabled — even when the app is closed');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function toggle(cat: string) {
    if (!prefs) return;
    const next = { ...prefs, [cat]: prefs[cat] === false ? true : false };
    setPrefs(next);
    try {
      await api('/api/notifications/preferences', { method: 'PUT', body: { preferences: next } });
    } catch (e) {
      toast.push('error', (e as Error).message);
      setPrefs(prefs);
    }
  }

  async function markAll() {
    await api('/api/notifications', { method: 'POST' }).catch(() => {});
    load();
  }

  if (!prefs) return <Loading />;

  return (
    <>
      <TopBar title="Notifications" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {pushState !== 'unsupported' && pushState !== 'noperm' && pushState !== 'on' && (
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold"><BellRing className="h-4 w-4 text-brand-600" /> Device push</p>
              <p className="text-xs text-slate-400">Get notified even when the app is closed</p>
            </div>
            <Button size="sm" onClick={enablePush}>Enable</Button>
          </Card>
        )}
        {pushState === 'on' && <Card className="p-3 text-center text-xs font-medium text-emerald-600">✓ Push notifications are enabled on this device</Card>}
        {pushState === 'noperm' && <Card className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">Push is blocked in your browser settings — allow notifications for this site, then tap Enable.</Card>}

        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Notification categories</h2>
          <p className="mb-3 text-xs text-slate-400">Turning a category off only stops notifications — nothing is deleted or hidden.</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <li key={cat} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{NOTIFICATION_LABELS[cat] || cat}</span>
                <button
                  role="switch"
                  aria-checked={prefs[cat] !== false}
                  onClick={() => toggle(cat)}
                  className={`relative h-6 w-11 rounded-full transition ${prefs[cat] === false ? 'bg-slate-300 dark:bg-slate-700' : 'bg-brand-600'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${prefs[cat] === false ? 'left-0.5' : 'left-[22px]'}`} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent notifications</h2>
            <Button size="sm" variant="ghost" onClick={markAll}>Mark all read</Button>
          </div>
          {notifications.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.slice(0, 30).map((n) => (
                <li key={n.id} className={`py-2.5 ${!n.readAt ? 'font-medium' : 'opacity-70'}`}>
                  <p className="text-sm">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.body}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
