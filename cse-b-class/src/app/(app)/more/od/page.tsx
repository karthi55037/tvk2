'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, StatusPill, Textarea, useToast, ConfirmButton } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { OD_STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { fmtDateTime, todayStr } from '@/lib/dates';
import { Plus } from 'lucide-react';

type OD = {
  id: string;
  userId: string;
  userName?: string;
  programName: string;
  place: string;
  date: string;
  fromTime: string;
  toTime: string;
  reason?: string;
  status: string;
  withdrawalRequested: boolean;
  createdAt: string;
  decisionNote?: string | null;
};

export default function ODPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<OD[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ programName: '', place: '', date: '', fromTime: '', toTime: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [letterFor, setLetterFor] = useState<OD | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const isAdvisor = user?.role === 'ADVISOR';
  const isRep = user?.role === 'REPRESENTATIVE';

  const load = useCallback(() => {
    api<{ requests: OD[] }>(isAdvisor || isRep ? '/api/od' : '/api/od?mine=1')
      .then((r) => setRows(r.requests))
      .catch((e) => toast.push('error', e.message));
  }, [isAdvisor, isRep, toast]);
  useEffect(load, [load]);

  async function submit() {
    setSaving(true);
    try {
      await api('/api/od', { method: 'POST', body: form });
      toast.push('success', 'OD request submitted — Advisor notified');
      setOpen(false);
      setForm({ programName: '', place: '', date: '', fromTime: '', toTime: '', reason: '' });
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.push('success', ok);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function viewLetter(id: string) {
    try {
      const r = await api<{ request: { documents: { fileId: string }[] } }>(`/api/od/${id}`);
      const fileId = r.request.documents?.[0]?.fileId;
      if (fileId && fileId !== 'protected') window.open(`/api/files/${fileId}`, '_blank');
      else toast.push('error', 'Letter not available');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!rows) return <Loading />;

  return (
    <>
      <TopBar title="OD (On Duty)" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {user?.role === 'STUDENT' || user?.role === 'REPRESENTATIVE' ? (
          <Button onClick={() => setOpen(true)} className="w-full">
            <Plus className="h-4 w-4" /> New OD request
          </Button>
        ) : null}
        {rows.length === 0 && <Card><EmptyState title="No OD requests" subtitle="OD requests are private between you and the Advisor." /></Card>}
        {rows.map((r) => (
          <Card key={r.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{r.userName || 'You'} — {r.programName}</p>
              <StatusPill value={r.status} label={OD_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
            </div>
            <p className="text-xs text-slate-500">{r.place} · {r.date} · {r.fromTime}–{r.toTime}</p>
            {(r.userId === user?.id || isAdvisor) && r.reason && (
              <p className="rounded-xl bg-slate-50 p-2.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{r.reason}</p>
            )}
            {r.decisionNote && <p className="text-xs italic text-slate-400">Advisor note: {r.decisionNote}</p>}
            {r.withdrawalRequested && <Badge tone="amber">Withdrawal requested — advisor review pending</Badge>}
            <p className="text-[11px] text-slate-400">Submitted {fmtDateTime(r.createdAt)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {r.userId === user?.id && r.status === 'PENDING' && (
                <ConfirmButton question="Withdraw this pending OD request?" onConfirm={() => act(r.id, () => api(`/api/od/${r.id}/withdraw`, { method: 'POST' }), 'Request withdrawn')} variant="secondary">
                  Withdraw
                </ConfirmButton>
              )}
              {r.userId === user?.id && r.status === 'LETTER_REQUIRED' && (
                <Button size="sm" onClick={() => setLetterFor(r)}>Post OD letter</Button>
              )}
              {isAdvisor && r.status === 'PENDING' && (
                <>
                  <Button size="sm" variant="success" onClick={() => act(r.id, () => api(`/api/od/${r.id}/decide`, { method: 'POST', body: { decision: 'APPROVE' } }), 'OD approved')}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/od/${r.id}/decide`, { method: 'POST', body: { decision: 'REJECT' } }), 'OD rejected')}>Reject</Button>
                </>
              )}
              {isRep && r.status === 'LETTER_POSTED' && (
                <Button size="sm" variant="success" onClick={() => act(r.id, () => api(`/api/od/${r.id}/confirm`, { method: 'POST' }), 'Letter confirmed')}>
                  Confirm letter completion
                </Button>
              )}
              {isAdvisor && r.withdrawalRequested && (
                <>
                  <Button size="sm" variant="danger" onClick={() => act(r.id, () => api(`/api/od/${r.id}/withdraw`, { method: 'PUT', body: { approve: true } }), 'OD withdrawn')}>Approve withdrawal</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(r.id, () => api(`/api/od/${r.id}/withdraw`, { method: 'PUT', body: { approve: false } }), 'Withdrawal declined')}>Decline withdrawal</Button>
                </>
              )}
              {['LETTER_POSTED', 'REP_CONFIRMED'].includes(r.status) && (r.userId === user?.id || isAdvisor || isRep) && (
                <Button size="sm" variant="secondary" onClick={() => viewLetter(r.id)}>View letter</Button>
              )}
            </div>
          </Card>
        ))}
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Workflow: request → Advisor approves (Reps are only notified) → you prepare the letter → HOD signing → post it here → a Representative confirms completion.
        </p>
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New OD request">
        <div className="space-y-3">
          <Input label="Program / Event name" value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} maxLength={150} />
          <Input label="Place" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} maxLength={150} />
          <Input label="Date" type="date" min={todayStr()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="From time" type="time" value={form.fromTime} onChange={(e) => setForm({ ...form, fromTime: e.target.value })} />
            <Input label="To time" type="time" value={form.toTime} onChange={(e) => setForm({ ...form, toTime: e.target.value })} />
          </div>
          <Textarea label="Reason (private)" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={1000} />
          <Button onClick={submit} loading={saving} disabled={!form.programName || !form.place || !form.date || !form.fromTime || !form.toTime || form.reason.trim().length < 2} className="w-full">
            Submit request
          </Button>
          <p className="text-center text-[11px] text-slate-400">No letter needed now — only after approval.</p>
        </div>
      </Modal>

      <Modal open={!!letterFor} onClose={() => setLetterFor(null)} title="Post completed OD letter">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Upload the completed OD letter after the required HOD signing process. A Representative will confirm its completion.</p>
          <Input label="Letter file (PDF or image)" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setLetterFile(e.target.files?.[0] || null)} />
          <Button
            onClick={async () => {
              if (!letterFor || !letterFile) return;
              const fd = new FormData();
              fd.append('file', letterFile);
              await act(letterFor.id, () => api(`/api/od/${letterFor.id}/letter`, { method: 'POST', formData: fd }), 'OD letter posted');
              setLetterFor(null);
              setLetterFile(null);
            }}
            disabled={!letterFile}
            className="w-full"
          >
            Post letter
          </Button>
        </div>
      </Modal>
    </>
  );
}
