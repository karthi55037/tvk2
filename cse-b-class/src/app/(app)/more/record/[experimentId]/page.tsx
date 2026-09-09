'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, onRealtime } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { ChatView } from '@/components/chat';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, StatusPill, Tabs, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { STATUS_TONE } from '@/lib/format';
import { CheckCircle2, Circle, Link2, Paperclip, Plus, XCircle } from 'lucide-react';

type Experiment = {
  id: string;
  subjectName: string;
  subjectCode: string;
  number: number;
  name: string;
  details: string | null;
  instructions: string | null;
  requiredFilesNote: string | null;
};
type Resource = { id: string; kind: string; title: string; url: string | null; fileId: string | null; status: string; uploaderName: string };
type Completion = { userId: string; name: string; regNo: string | null; completion: string | null; recordStatus: string | null; recordFileId: string | null };
type MyRecord = { id: string; status: string; verificationNote: string | null; fileId: string; uploadedAt: string } | null;

export default function ExperimentPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [exp, setExp] = useState<Experiment | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [completions, setCompletions] = useState<Completion[] | null>(null);
  const [myRecord, setMyRecord] = useState<MyRecord>(null);
  const [myCompletion, setMyCompletion] = useState<string | null>(null);
  const [tab, setTab] = useState('info');
  const [shareOpen, setShareOpen] = useState(false);
  const [kind, setKind] = useState('LINK');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [recordNote, setRecordNote] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const isStaff = user && user.role !== 'STUDENT';
  const isStudent = user && (user.role === 'STUDENT' || user.role === 'REPRESENTATIVE');

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api<{ experiment: Experiment }>(`/api/experiments/${experimentId}`),
        api<{ resources: Resource[] }>(`/api/experiments/${experimentId}/resources`),
      ]);
      setExp(a.experiment);
      setResources(b.resources);
      if (isStudent) {
        const [r, c] = await Promise.all([
          api<{ record: MyRecord }>(`/api/experiments/${experimentId}/record`),
          api<{ completions: Completion[] }>(`/api/experiments/${experimentId}/completion`),
        ]);
        setMyRecord(r.record);
        const me = c.completions.find((x) => x.userId === user?.id);
        setMyCompletion(me?.completion ?? null);
        if (isStaff) setCompletions(c.completions);
      }
      if (isStaff) {
        const c = await api<{ completions: Completion[] }>(`/api/experiments/${experimentId}/completion`);
        setCompletions(c.completions);
      }
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }, [experimentId, isStudent, isStaff, user?.id, toast]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onRealtime(`experiment:${experimentId}`, load), [experimentId, load]);

  async function setCompletion(status: 'COMPLETED' | 'NOT_COMPLETED') {
    try {
      await api(`/api/experiments/${experimentId}/completion`, { method: 'POST', body: { status } });
      toast.push('success', status === 'COMPLETED' ? 'Marked completed' : 'Marked not completed');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function uploadRecord() {
    if (!recordFile) return;
    const fd = new FormData();
    fd.append('file', recordFile);
    if (recordNote) fd.append('note', recordNote);
    try {
      await api(`/api/experiments/${experimentId}/record`, { method: 'POST', formData: fd });
      toast.push('success', 'Record file uploaded — awaiting verification');
      setUploadOpen(false);
      setRecordFile(null);
      setRecordNote('');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function verifyRecord(studentId: string, decision: 'VERIFIED' | 'REJECTED') {
    try {
      await api(`/api/experiments/${experimentId}/record`, { method: 'PUT', body: { studentId, decision } });
      toast.push('success', decision === 'VERIFIED' ? 'Record verified' : 'Record rejected');
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
        fd.append('module', 'EXPERIMENT');
        fd.append('entityId', experimentId);
        const r = await api<{ file: { id: string } }>('/api/files', { method: 'POST', formData: fd });
        fileId = r.file.id;
      }
      await api(`/api/experiments/${experimentId}/resources`, { method: 'POST', body: { kind, title, url: url || undefined, fileId } });
      toast.push('success', isStaff ? 'Resource published' : 'Shared for verification');
      setShareOpen(false);
      setTitle('');
      setUrl('');
      setFile(null);
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function verifyResource(resourceId: string, decision: 'APPROVED' | 'REJECTED') {
    try {
      await api(`/api/experiments/${experimentId}/resources`, { method: 'POST', body: { verifyResourceId: resourceId, decision } });
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!exp) return <Loading />;
  const pending = resources.filter((r) => r.status === 'PENDING');

  return (
    <>
      <TopBar title={`Exp ${exp.number} · ${exp.subjectName}`} />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Link href="/more/record" className="text-sm text-brand-600 hover:underline dark:text-brand-400">← Record & Observation</Link>
        <Card className="p-4">
          <h2 className="text-lg font-bold">{exp.name}</h2>
          {exp.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{exp.details}</p>}
          {exp.instructions && <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60"><b>Instructions:</b> {exp.instructions}</p>}
          {exp.requiredFilesNote && <p className="mt-1.5 text-xs text-slate-400">📎 Required: {exp.requiredFilesNote}</p>}
          {isStudent && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <Button size="sm" variant={myCompletion === 'COMPLETED' ? 'success' : 'secondary'} onClick={() => setCompletion('COMPLETED')}>
                  <CheckCircle2 className="h-4 w-4" /> Completed
                </Button>
                <Button size="sm" variant={myCompletion === 'NOT_COMPLETED' ? 'danger' : 'secondary'} onClick={() => setCompletion('NOT_COMPLETED')}>
                  <XCircle className="h-4 w-4" /> Not completed
                </Button>
                <Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}>
                  <Paperclip className="h-4 w-4" /> {myRecord ? 'Replace record file' : 'Upload record file'}
                </Button>
              </div>
              {myRecord && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <StatusPill value={myRecord.status} tone={STATUS_TONE} />
                  <a href={`/api/files/${myRecord.fileId}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline dark:text-brand-400">view my file</a>
                  {myRecord.verificationNote && <span className="text-xs italic text-slate-400">“{myRecord.verificationNote}”</span>}
                </div>
              )}
            </div>
          )}
        </Card>

        <Tabs
          tabs={[
            { id: 'info', label: 'Resources', badge: isStaff && pending.length ? pending.length : undefined },
            { id: 'class', label: 'Class status' },
            { id: 'chat', label: 'Chat' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'info' && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Approved resources</h3>
              <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}><Plus className="h-4 w-4" /> Share</Button>
            </div>
            {resources.length === 0 ? (
              <EmptyState title="No resources yet" />
            ) : (
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">{r.kind === 'LINK' ? <Link2 className="mr-1 inline h-3.5 w-3.5 text-brand-500" /> : <Paperclip className="mr-1 inline h-3.5 w-3.5 text-brand-500" />}{r.title}</p>
                      <StatusPill value={r.status} tone={STATUS_TONE} />
                    </div>
                    {r.kind === 'LINK' && r.url && <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-600 hover:underline dark:text-brand-400">{r.url}</a>}
                    {r.kind === 'FILE' && r.fileId && <a href={`/api/files/${r.fileId}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-600 hover:underline dark:text-brand-400">Open file</a>}
                    {r.status === 'PENDING' && isStaff && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="success" onClick={() => verifyResource(r.id, 'APPROVED')}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => verifyResource(r.id, 'REJECTED')}>Reject</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'class' && completions && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Completion & record verification</h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {completions.map((c) => (
                <li key={c.userId} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.regNo}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.completion ? <StatusPill value={c.completion} tone={STATUS_TONE} /> : <Badge tone="gray">—</Badge>}
                    {c.recordStatus ? <StatusPill value={c.recordStatus} tone={STATUS_TONE} /> : <Badge tone="gray">no file</Badge>}
                    {isStaff && c.recordStatus === 'PENDING' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="success" onClick={() => verifyRecord(c.userId, 'VERIFIED')}>✓</Button>
                        <Button size="sm" variant="danger" onClick={() => verifyRecord(c.userId, 'REJECTED')}>✗</Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {tab === 'chat' && <Card className="overflow-hidden"><ChatView endpoint={`/api/chat/experiment/${experimentId}`} topic={`chat:EXPERIMENT:${experimentId}`} /></Card>}
      </main>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload record file">
        <div className="space-y-3">
          <Input label="Record file (PDF, doc, images…)" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.zip,.odt" onChange={(e) => setRecordFile(e.target.files?.[0] || null)} />
          <Input label="Note (optional)" value={recordNote} onChange={(e) => setRecordNote(e.target.value)} maxLength={300} />
          <Button onClick={uploadRecord} disabled={!recordFile} className="w-full">Upload</Button>
          {myRecord && <p className="text-center text-xs text-slate-400">Re-uploading replaces your file and resets verification — previous state is audit-logged.</p>}
        </div>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share a resource">
        <div className="space-y-3">
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="LINK">Link</option>
            <option value="FILE">File</option>
          </Select>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          {kind === 'LINK' ? (
            <Input label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          ) : (
            <Input label="File" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          )}
          <Button onClick={share} disabled={!title.trim()} className="w-full">Share</Button>
        </div>
      </Modal>
    </>
  );
}
