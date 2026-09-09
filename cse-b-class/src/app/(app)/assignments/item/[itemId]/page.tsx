'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, onRealtime } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { ChatView } from '@/components/chat';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, StatusPill, Tabs, Textarea, useToast, ConfirmButton } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { fmtDateTime } from '@/lib/dates';
import { STATUS_TONE } from '@/lib/format';
import { CheckCircle2, Link2, Paperclip, Plus, Trash2, XCircle } from 'lucide-react';

type ItemDetail = {
  id: string;
  folderNumber: number;
  subjectName: string;
  subjectCode: string;
  facultyName: string;
  title: string;
  instructions: string | null;
  deadline: string | null;
  requiredFilesNote: string | null;
};

type Resource = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  fileId: string | null;
  status: string;
  uploaderName: string;
  note: string | null;
};

type Submission = { userId: string; name: string; regNo: string | null; status: string | null };

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [subs, setSubs] = useState<{ submissions: Submission[]; stats: { submitted: number; total: number; pending: number } } | null>(null);
  const [tab, setTab] = useState('info');

  // share resource
  const [shareOpen, setShareOpen] = useState(false);
  const [kind, setKind] = useState('LINK');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const isStaff = user?.role !== 'STUDENT';

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        api<{ item: ItemDetail }>(`/api/assignments/items/${itemId}`),
        api<{ resources: Resource[] }>(`/api/assignments/items/${itemId}/resources`),
        api<{ submissions: Submission[]; stats: { submitted: number; total: number; pending: number } }>(`/api/assignments/items/${itemId}/submissions`),
      ]);
      setItem(a.item);
      setResources(b.resources);
      setSubs(c);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }, [itemId, toast]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onRealtime(`assignment:${itemId}`, load), [itemId, load]);

  async function setMyStatus(status: 'SUBMITTED' | 'NOT_SUBMITTED') {
    try {
      await api(`/api/assignments/items/${itemId}/submissions`, { method: 'POST', body: { status } });
      toast.push('success', `Marked ${status === 'SUBMITTED' ? 'Submitted' : 'Not Submitted'}`);
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function share() {
    try {
      let fileId: string | undefined;
      if (kind === 'FILE') {
        if (!file) return toast.push('error', 'Choose a file');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', 'ASSIGNMENT');
        fd.append('entityId', itemId);
        const r = await api<{ file: { id: string } }>('/api/files', { method: 'POST', formData: fd });
        fileId = r.file.id;
      }
      await api(`/api/assignments/items/${itemId}/resources`, { method: 'POST', body: { kind, title, url: url || undefined, fileId } });
      toast.push('success', isStaff ? 'Resource published' : 'Shared — a Representative will verify it');
      setShareOpen(false);
      setTitle('');
      setUrl('');
      setFile(null);
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function verify(resourceId: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      await api(`/api/assignments/resources/${resourceId}`, { method: 'POST', body: { decision } });
      toast.push('success', decision === 'APPROVED' ? 'Approved' : 'Rejected');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function setOtherStatus(userId: string, status: 'SUBMITTED' | 'NOT_SUBMITTED') {
    try {
      await api(`/api/assignments/items/${itemId}/submissions`, { method: 'POST', body: { status, userId } });
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!item) return <Loading />;
  const mySub = subs?.submissions.find((s) => s.userId === user?.id);
  const pending = resources.filter((r) => r.status === 'PENDING');

  return (
    <>
      <TopBar title={item.subjectName} />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Link href="/assignments" className="text-sm text-brand-600 hover:underline dark:text-brand-400">← Assignments</Link>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Assignment {item.folderNumber} · {item.subjectCode}</p>
              <h2 className="mt-0.5 text-lg font-bold">{item.title}</h2>
            </div>
            {item.deadline && <Badge tone={new Date(item.deadline) < new Date() ? 'red' : 'blue'}>Due {fmtDateTime(item.deadline)}</Badge>}
          </div>
          {item.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{item.instructions}</p>}
          {item.requiredFilesNote && <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60">📎 Required files: {item.requiredFilesNote}</p>}
          {user && (user.role === 'STUDENT' || user.role === 'REPRESENTATIVE') && (
            <div className="mt-4 flex gap-2">
              <Button variant={mySub?.status === 'SUBMITTED' ? 'success' : 'secondary'} size="sm" onClick={() => setMyStatus('SUBMITTED')}>
                <CheckCircle2 className="h-4 w-4" /> I submitted
              </Button>
              <Button variant={mySub?.status === 'NOT_SUBMITTED' ? 'danger' : 'secondary'} size="sm" onClick={() => setMyStatus('NOT_SUBMITTED')}>
                <XCircle className="h-4 w-4" /> Not submitted
              </Button>
            </div>
          )}
        </Card>

        <Tabs
          tabs={[
            { id: 'info', label: 'Resources', badge: isStaff && pending.length ? pending.length : undefined },
            { id: 'subs', label: `Submissions (${subs?.stats.submitted ?? 0}/${subs?.stats.total ?? 0})` },
            { id: 'chat', label: 'Chat' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'info' && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Files & resources</h3>
              <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                <Plus className="h-4 w-4" /> Share
              </Button>
            </div>
            {resources.length === 0 ? (
              <EmptyState title="No resources yet" subtitle="Share PDFs, links, GitHub repos, YouTube videos — approved items are visible to everyone." />
            ) : (
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {r.kind === 'LINK' ? <Link2 className="h-3.5 w-3.5 text-brand-500" /> : <Paperclip className="h-3.5 w-3.5 text-brand-500" />}
                          {r.title}
                        </p>
                        <p className="text-xs text-slate-400">by {r.uploaderName}</p>
                      </div>
                      <StatusPill value={r.status} tone={STATUS_TONE} />
                    </div>
                    {r.kind === 'LINK' && r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="mt-1.5 block truncate text-xs text-brand-600 hover:underline dark:text-brand-400">{r.url}</a>
                    ) : r.fileId ? (
                      <a href={`/api/files/${r.fileId}`} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs text-brand-600 hover:underline dark:text-brand-400">Open file</a>
                    ) : null}
                    {r.status === 'PENDING' && isStaff && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="success" onClick={() => verify(r.id, 'APPROVED')}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => verify(r.id, 'REJECTED')}>Reject</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'subs' && subs && (
          <Card className="p-4">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-500/10">
                <p className="text-lg font-bold text-emerald-600">{subs.stats.submitted}</p>
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70">Submitted</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-2 dark:bg-rose-500/10">
                <p className="text-lg font-bold text-rose-600">{subs.stats.pending}</p>
                <p className="text-[11px] text-rose-700/70 dark:text-rose-400/70">Pending</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
                <p className="text-lg font-bold">{subs.stats.total}</p>
                <p className="text-[11px] text-slate-400">Total</p>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {subs.submissions.map((s) => (
                <li key={s.userId} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.regNo}</p>
                  </div>
                  {isStaff ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant={s.status === 'SUBMITTED' ? 'success' : 'secondary'} onClick={() => setOtherStatus(s.userId, 'SUBMITTED')}>✓</Button>
                      <Button size="sm" variant={s.status === 'NOT_SUBMITTED' ? 'danger' : 'secondary'} onClick={() => setOtherStatus(s.userId, 'NOT_SUBMITTED')}>✗</Button>
                    </div>
                  ) : (
                    <StatusPill value={s.status || 'PENDING'} label={s.status === 'SUBMITTED' ? 'Submitted' : s.status === 'NOT_SUBMITTED' ? 'Not submitted' : '—'} tone={STATUS_TONE} />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {tab === 'chat' && <Card className="overflow-hidden"><ChatView endpoint={`/api/chat/assignment/${itemId}`} topic={`chat:ASSIGNMENT:${itemId}`} /></Card>}
      </main>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share a resource">
        <div className="space-y-3">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="LINK">Link (YouTube, GitHub, Drive, ChatGPT…)</option>
            <option value="FILE">File (PDF, docs, images…)</option>
          </Select>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sorting algorithms explained" maxLength={150} />
          {kind === 'LINK' ? (
            <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />
          ) : (
            <Input label="File" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip,.ppt,.pptx,.xls,.xlsx" />
          )}
          {!isStaff && <p className="text-xs text-slate-400">Your share will be visible to everyone after a Representative verifies it.</p>}
          <Button onClick={share} className="w-full" disabled={!title.trim()}>Share</Button>
        </div>
      </Modal>
    </>
  );
}
