'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, StatusPill, Textarea, useToast, ConfirmButton } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { LEAVE_STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { fmtDateTime, todayStr } from '@/lib/dates';
import { Plus } from 'lucide-react';

type Leave = {
  id: string;
  userId: string;
  userName?: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  status: string;
  withdrawalRequested: boolean;
  createdAt: string;
  decisionNote?: string | null;
};

export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Leave[] | null>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [letterFor, setLetterFor] = useState<Leave | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const isAdvisor = user?.role === 'ADVISOR';
  const isRep = user?.role === 'REPRESENTATIVE';

  const load = useCallback(() => {
    api<{ requests: Leave[] }>(isAdvisor || isRep ? '/api/leave' : '/api/leave?mine=1')
      .then((r) => setRows(r.requests))
      .catch((e) => toast.push('error', e.message));
  }, [isAdvisor, isRep, toast]);
  useEffect(load, [load]);

  async function submit() {
    setSaving(true);
    try {
      await api('/api/leave', { method: 'POST', body: { fromDate: from, toDate: to || from, reason, contact: contact || undefined } });
      toast.push('success', 'Leave request submitted — your Advisor has been notified');
      setOpen(false);
      setFrom('');
      setTo('');
      setReason('');
      setContact('');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(id: string) {
    try {
      await api(`/api/leave/${id}/withdraw`, { method: 'POST' });
      toast.push('success', 'Request withdrawn');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function decide(id: string, decision: 'APPROVE' | 'REJECT') {
    try {
      await api(`/api/leave/${id}/decide`, { method: 'POST', body: { decision } });
      toast.push('success', decision === 'APPROVE' ? 'Approved — student can post the letter' : 'Rejected');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function uploadLetter() {
    if (!letterFor || !letterFile) return;
    const fd = new FormData();
    fd.append('file', letterFile);
    try {
      await api(`/api/leave/${letterFor.id}/letter`, { method: 'POST', formData: fd });
      toast.push('success', 'Signed letter posted — awaiting representative confirmation');
      setLetterFor(null);
      setLetterFile(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function confirmLetter(id: string) {
    try {
      await api(`/api/leave/${id}/confirm`, { method: 'POST' });
      toast.push('success', 'Letter confirmed');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function viewLetter(id: string) {
    try {
      const r = await api<{ request: { documents: { fileId: string }[] } }>(`/api/leave/${id}`);
      const fileId = r.request.documents?.[0]?.fileId;
      if (fileId && fileId !== 'protected') window.open(`/api/files/${fileId}`, '_blank');
      else toast.push('error', 'Letter not available');
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function resolveWithdraw(id: string, approve: boolean) {
    try {
      await api(`/api/leave/${id}/withdraw`, { method: 'PUT', body: { approve } });
      toast.push('success', approve ? 'Leave withdrawn' : 'Withdrawal declined');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!rows) return <Loading />;

  return (
    <>
      <TopBar title="Leave" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {user?.role === 'STUDENT' || user?.role === 'REPRESENTATIVE' ? (
          <Button onClick={() => setOpen(true)} className="w-full">
            <Plus className="h-4 w-4" /> New leave request
          </Button>
        ) : null}
        {rows.length === 0 && <Card><EmptyState title="No leave requests" subtitle="Requests stay private between you and the Advisor." /></Card>}
        {rows.map((r) => (
          <Card key={r.id} className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {r.userName || 'You'} — {r.fromDate}{r.toDate !== r.fromDate ? ` → ${r.toDate}` : ''}
              </p>
              <StatusPill value={r.status} label={LEAVE_STATUS_LABEL[r.status]} tone={STATUS_TONE} />
            </div>
            {(r.userId === user?.id || isAdvisor) && r.reason && <p className="rounded-xl bg-slate-50 p-2.5 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{r.reason}</p>}
            {r.decisionNote && <p className="text-xs italic text-slate-400">Advisor note: {r.decisionNote}</p>}
            {r.withdrawalRequested && <Badge tone="amber">Withdrawal requested — advisor review pending</Badge>}
            <p className="text-[11px] text-slate-400">Submitted {fmtDateTime(r.createdAt)}</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {r.userId === user?.id && r.status === 'PENDING' && (
                <ConfirmButton question="Withdraw this pending leave request?" onConfirm={() => withdraw(r.id)} variant="secondary">
                  Withdraw
                </ConfirmButton>
              )}
              {r.userId === user?.id && ['LETTER_PENDING', 'LETTER_POSTED'].includes(r.status) && (
                <Button size="sm" variant="secondary" onClick={() => resolveWithdraw(r.id, true) as never} className="hidden" />
              )}
              {r.userId === user?.id && r.status === 'LETTER_PENDING' && (
                <Button size="sm" onClick={() => setLetterFor(r)}>Post signed letter</Button>
              )}
              {isAdvisor && r.status === 'PENDING' && (
                <>
                  <Button size="sm" variant="success" onClick={() => decide(r.id, 'APPROVE')}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => decide(r.id, 'REJECT')}>Reject</Button>
                </>
              )}
              {isRep && r.status === 'LETTER_POSTED' && (
                <Button size="sm" variant="success" onClick={() => confirmLetter(r.id)}>Confirm letter</Button>
              )}
              {isAdvisor && r.withdrawalRequested && (
                <>
                  <Button size="sm" variant="danger" onClick={() => resolveWithdraw(r.id, true)}>Approve withdrawal</Button>
                  <Button size="sm" variant="secondary" onClick={() => resolveWithdraw(r.id, false)}>Decline withdrawal</Button>
                </>
              )}
              {['LETTER_POSTED', 'REP_CONFIRMED'].includes(r.status) && (r.userId === user?.id || isAdvisor || isRep) && (
                <a href={`/api/leave-file/${r.id}`} className="hidden" aria-hidden />
              )}
            </div>
          </Card>
        ))}
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Workflow: you request → Advisor approves → you post the signed letter here → any one Representative confirms it. Reasons stay private.
        </p>
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New leave request">
        <div className="space-y-3">
          <Input label="From date" type="date" value={from} min={todayStr()} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To date (inclusive)" type="date" value={to} min={from || todayStr()} onChange={(e) => setTo(e.target.value)} />
          <Textarea label="Reason / details (private — only you and the Advisor)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          <Input label="Contact during leave (optional)" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={20} />
          <Button onClick={submit} loading={saving} disabled={!from || reason.trim().length < 2} className="w-full">Submit request</Button>
          <p className="text-center text-[11px] text-slate-400">No letter is needed at submission — you&apos;ll post the signed letter after approval.</p>
        </div>
      </Modal>

      <Modal open={!!letterFor} onClose={() => setLetterFor(null)} title="Post signed leave letter">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Upload the signed letter (after the required signing process). Representatives will view and confirm it.</p>
          <Input label="Letter file (PDF or image)" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setLetterFile(e.target.files?.[0] || null)} />
          <Button onClick={uploadLetter} disabled={!letterFile} className="w-full">Post letter</Button>
        </div>
      </Modal>
    </>
  );
}
