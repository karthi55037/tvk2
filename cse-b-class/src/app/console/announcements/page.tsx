'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Button, Card, Input, Loading, Textarea, useToast, ConfirmButton, Badge } from '@/components/ui';
import { fmtDateTime } from '@/lib/dates';
import { Megaphone, Plus, Trash2 } from 'lucide-react';

type Announcement = { id: string; title: string; message: string; link: string | null; creatorName: string; createdAt: string };

export default function AnnouncementsConsole() {
  const toast = useToast();
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [form, setForm] = useState({ title: '', message: '', link: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ announcements: Announcement[] }>('/api/announcements').then((r) => setRows(r.announcements)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function create() {
    setBusy(true);
    try {
      await api('/api/announcements', { method: 'POST', body: { title: form.title, message: form.message, link: form.link || undefined } });
      toast.push('success', 'Announcement published — push notifications sent per preferences');
      setForm({ title: '', message: '', link: '' });
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Announcements</h1>
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="h-4 w-4 text-brand-600" /> New announcement</div>
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} />
        <Textarea label="Message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={4000} />
        <Input label="Optional link" type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
        <Button onClick={create} loading={busy} disabled={form.title.length < 2 || form.message.length < 2} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Publish
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id} className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{a.title} <Badge tone="brand">{a.creatorName}</Badge></p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{a.message}</p>
              {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline dark:text-brand-400">{a.link}</a>}
              <p className="mt-1 text-[11px] text-slate-400">{fmtDateTime(a.createdAt)}</p>
            </div>
            <ConfirmButton question="Remove this announcement?" onConfirm={async () => { try { await api(`/api/announcements/${a.id}`, { method: 'DELETE' }); toast.push('success', 'Removed'); load(); } catch (e) { toast.push('error', (e as Error).message); } }}>
              <Trash2 className="h-3.5 w-3.5" />
            </ConfirmButton>
          </Card>
        ))}
        {rows.length === 0 && <Card className="p-8 text-center text-sm text-slate-400">No announcements yet.</Card>}
      </div>
    </div>
  );
}
