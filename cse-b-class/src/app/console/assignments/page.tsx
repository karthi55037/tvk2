'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Badge, Button, Card, Input, Loading, Modal, Select, StatusPill, Tabs, Textarea, useToast, ConfirmButton } from '@/components/ui';
import { STATUS_TONE } from '@/lib/format';
import { fmtDateTime } from '@/lib/dates';
import { Plus } from 'lucide-react';

type Folder = { id: string; number: number; status: string };
type Item = { id: string; subjectName: string; subjectCode: string; title: string; deadline: string | null; myStatus: string | null; submitted: number; total: number };
type Subject = { id: string; name: string; code: string };
type Resource = { id: string; kind: string; title: string; url: string | null; fileId: string | null; status: string; uploaderName: string; itemId: string };

export default function AssignmentsConsole() {
  const toast = useToast();
  const [tab, setTab] = useState('folders');
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', title: '', instructions: '', deadline: '', requiredFilesNote: '' });

  const load = useCallback(async () => {
    try {
      const f = await api<{ folders: Folder[] }>('/api/assignments/folders');
      setFolders(f.folders);
      const id = activeFolder || f.folders.find((x) => x.status === 'ACTIVE')?.id || f.folders[0]?.id || '';
      setActiveFolder(id);
      if (id) {
        const i = await api<{ items: Item[] }>(`/api/assignments/items?folderId=${id}`);
        setItems(i.items);
      } else setItems([]);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }, [activeFolder, toast]);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api<{ subjects: Subject[] }>('/api/subjects').then((r) => setSubjects(r.subjects)).catch(() => {});
  }, []);

  async function createFolder() {
    try {
      await api('/api/assignments/folders', { method: 'POST' });
      toast.push('success', 'Assignment folder created');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function toggleFolder(f: Folder) {
    try {
      await api(`/api/assignments/folders/${f.id}/status`, { method: 'POST', body: { status: f.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE' } });
      toast.push('success', f.status === 'ACTIVE' ? 'Moved to Completed Assignments' : 'Reactivated');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function createItem() {
    try {
      await api('/api/assignments/items', { method: 'POST', body: { ...form, folderId: activeFolder, deadline: form.deadline || undefined } });
      toast.push('success', 'Assignment published — class notified');
      setNewOpen(false);
      setForm({ subjectId: '', title: '', instructions: '', deadline: '', requiredFilesNote: '' });
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function removeItem(id: string) {
    try {
      await api(`/api/assignments/items/${id}`, { method: 'DELETE' });
      toast.push('success', 'Assignment archived');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  const folder = folders?.find((f) => f.id === activeFolder);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Assignments</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={createFolder}><Plus className="h-4 w-4" /> New Assignment set</Button>
          <Button disabled={!folder || folder.status !== 'ACTIVE'} onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Add subject assignment</Button>
        </div>
      </div>

      <Tabs tabs={[{ id: 'folders', label: 'Assignment sets' }, { id: 'items', label: 'Items & submissions' }, { id: 'verify', label: 'Resource verification' }]} active={tab} onChange={setTab} />

      {tab === 'folders' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {folders?.map((f) => (
            <Card key={f.id} className={`p-4 ${f.id === activeFolder ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">Assignment {f.number}</p>
                <Badge tone={f.status === 'ACTIVE' ? 'blue' : 'gray'}>{f.status}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setActiveFolder(f.id); setTab('items'); }}>Open</Button>
                <Button size="sm" variant={f.status === 'ACTIVE' ? 'success' : 'secondary'} onClick={() => toggleFolder(f)}>
                  {f.status === 'ACTIVE' ? 'Mark completed' : 'Reopen'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'items' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Assignment set: <b>{folder ? `Assignment ${folder.number}` : '— none selected'}</b></p>
          {items?.length === 0 && <Card className="p-8 text-center text-sm text-slate-400">No subject assignments in this set yet.</Card>}
          {items?.map((it) => (
            <Card key={it.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{it.subjectName} <span className="ml-1 text-xs font-mono text-brand-600">{it.subjectCode}</span></p>
                <p className="text-sm text-slate-500">{it.title}</p>
                <p className="text-xs text-slate-400">{it.deadline ? `Due ${fmtDateTime(it.deadline)} · ` : ''}{it.submitted}/{it.total} submitted</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/assignments/item/${it.id}`} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium dark:bg-slate-800">Open workspace</Link>
                <ConfirmButton question={`Archive "${it.title}"? Records are retained and can be restored from history.`} onConfirm={() => removeItem(it.id)}>
                  Archive
                </ConfirmButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'verify' && <ResourceQueue />}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title={`New assignment in ${folder ? `Assignment ${folder.number}` : ''}`}>
        <div className="space-y-3">
          <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </Select>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Assignment 1 — Linked Lists" />
          <Textarea label="Instructions" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          <Input label="Deadline (optional)" type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <Input label="Required files note (optional)" value={form.requiredFilesNote} onChange={(e) => setForm({ ...form, requiredFilesNote: e.target.value })} />
          <Button onClick={createItem} disabled={!form.subjectId || form.title.length < 2} className="w-full">Publish (notifies class)</Button>
        </div>
      </Modal>
    </div>
  );
}

type PResource = { id: string; kind: string; title: string; url: string | null; fileId: string | null; status: string; uploaderName: string; createdAt: string; itemId: string };

function ResourceQueue() {
  const toast = useToast();
  const [rows, setRows] = useState<PResource[] | null>(null);
  const load = useCallback(() => {
    // pending queues surface via each item's resources; aggregate via items the reps manage
    api<{ folders: { id: string; number: number }[] }>('/api/assignments/folders')
      .then(async (f) => {
        const all: PResource[] = [];
        for (const folder of f.folders) {
          const items = await api<{ items: { id: string }[] }>(`/api/assignments/items?folderId=${folder.id}`);
          for (const item of items.items) {
            const r = await api<{ resources: PResource[] }>(`/api/assignments/items/${item.id}/resources`);
            all.push(...r.resources.filter((x) => x.status === 'PENDING'));
          }
        }
        setRows(all);
      })
      .catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function verify(id: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      await api(`/api/assignments/resources/${id}`, { method: 'POST', body: { decision } });
      toast.push('success', decision === 'APPROVED' ? 'Approved & published' : 'Rejected');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!rows) return <Loading />;
  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-slate-400">No resources waiting for verification.</Card>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-medium">{r.title} <Badge tone="gray">{r.kind}</Badge></p>
            <p className="text-xs text-slate-400">shared by {r.uploaderName}</p>
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">{r.url}</a>}
            {r.fileId && <a href={`/api/files/${r.fileId}`} target="_blank" rel="noreferrer" className="block text-xs text-brand-600 underline">open file</a>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="success" onClick={() => verify(r.id, 'APPROVED')}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => verify(r.id, 'REJECTED')}>Reject</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
