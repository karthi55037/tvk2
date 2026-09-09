'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, EmptyState, Loading, StatusPill, Tabs, Textarea, useToast, Modal } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { STATUS_TONE } from '@/lib/format';
import { fmtDateTime } from '@/lib/dates';

type Report = {
  id: string;
  messageId: string;
  category: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reportedBy: string;
  msgBody: string | null;
  msgFileId: string | null;
  msgDeletedAt: string | null;
  msgThreadType: string;
};
type Clearing = {
  id: string;
  scope: string;
  targetPreview: string;
  reason: string;
  status: string;
  createdAt: string;
  executedAt: string | null;
  requestedByName: string;
  approvals: { approverName: string; approverRole: string; at: string }[];
  pendingFrom: { advisor: boolean; representatives: number; admin: boolean };
};

export default function ModerationConsole() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [clearing, setClearing] = useState<Clearing[] | null>(null);
  const [takedown, setTakedown] = useState<Report | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    if (user?.role === 'ADVISOR' || user?.role === 'ADMIN') {
      api<{ reports: Report[] }>('/api/reports').then((r) => setReports(r.reports)).catch(() => setReports([]));
    } else setReports([]);
    api<{ requests: Clearing[] }>('/api/clearing').then((r) => setClearing(r.requests)).catch((e) => toast.push('error', e.message));
  }, [user?.role, toast]);
  useEffect(load, [load]);

  async function resolve(id: string, outcome: 'RESOLVED' | 'DISMISSED') {
    try {
      await api(`/api/reports/${id}/resolve`, { method: 'POST', body: { outcome } });
      toast.push('success', outcome === 'RESOLVED' ? 'Report resolved' : 'Report dismissed');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function runTakedown() {
    if (!takedown) return;
    try {
      await api(`/api/chat/messages/${takedown.messageId}`, { method: 'POST', body: { action: 'EMERGENCY_TAKEDOWN', note } });
      toast.push('success', 'Message removed (emergency takedown, audit-logged)');
      setTakedown(null);
      setNote('');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function approveClearing(id: string) {
    try {
      const r = await api<{ request: { status: string } }>(`/api/clearing/${id}/approve`, { method: 'POST', body: {} });
      toast.push('success', r.request.status === 'EXECUTED' ? 'All approvals received — content cleared' : 'Approval recorded — waiting for remaining approvers');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  const openReports = reports?.filter((r) => r.status === 'OPEN') ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="text-sm text-slate-400">Reports from representatives + the class-chat clearing approval flow (Advisor + all Representatives + Admin).</p>
      </div>

      <Tabs tabs={[{ id: 'reports', label: `Reports (${openReports.length})` }, { id: 'clearing', label: `Clearing requests (${clearing?.filter((c) => c.status === 'PENDING').length ?? 0})` }]} active={tab} onChange={setTab} />

      {tab === 'reports' && (
        <div className="space-y-2">
          {!reports ? (
            <Loading />
          ) : openReports.length === 0 ? (
            <Card><EmptyState title="No open reports" /></Card>
          ) : (
            openReports.map((r) => (
              <Card key={r.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium"><Badge tone="red">{r.category}</Badge> <span className="ml-1 text-sm">reported by {r.reportedBy}</span></p>
                  <span className="text-[11px] text-slate-400">{fmtDateTime(r.createdAt)}</span>
                </div>
                <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{r.msgBody || '📎 file attachment'}</p>
                {r.description && <p className="text-xs italic text-slate-500">“{r.description}”</p>}
                {r.msgThreadType !== 'CLASS' && <Badge tone="blue">{r.msgThreadType} chat</Badge>}
                <div className="flex flex-wrap gap-2">
                  {(user?.role === 'ADVISOR' || user?.role === 'ADMIN') && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => resolve(r.id, 'DISMISSED')}>Dismiss</Button>
                      <Button size="sm" variant="success" onClick={() => resolve(r.id, 'RESOLVED')}>Mark resolved</Button>
                      {r.msgThreadType === 'CLASS' && user?.role === 'ADMIN' && !r.msgDeletedAt && (
                        <Button size="sm" variant="danger" onClick={() => setTakedown(r)}>Emergency takedown</Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'clearing' && (
        <div className="space-y-2">
          {!clearing ? (
            <Loading />
          ) : clearing.length === 0 ? (
            <Card><EmptyState title="No clearing requests" subtitle="Requests appear here when representatives/advisor ask to clear class-chat content." /></Card>
          ) : (
            clearing.map((c) => (
              <Card key={c.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.targetPreview}</p>
                  <StatusPill value={c.status} tone={STATUS_TONE} />
                </div>
                <p className="text-sm text-slate-500">Reason: {c.reason}</p>
                <p className="text-xs text-slate-400">Requested by {c.requestedByName} · {fmtDateTime(c.createdAt)} · scope {c.scope}</p>
                {c.status === 'PENDING' && (
                  <>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {c.pendingFrom.advisor && <Badge tone="amber">awaiting Advisor</Badge>}
                      {c.pendingFrom.representatives > 0 && <Badge tone="amber">awaiting {c.pendingFrom.representatives} rep{c.pendingFrom.representatives > 1 ? 's' : ''}</Badge>}
                      {c.pendingFrom.admin && <Badge tone="amber">awaiting Admin</Badge>}
                    </div>
                    {c.approvals.length > 0 && (
                      <p className="text-xs text-slate-400">Approved by: {c.approvals.map((a) => `${a.approverName} (${a.approverRole})`).join(', ')}</p>
                    )}
                    <Button size="sm" onClick={() => approveClearing(c.id)}>Approve clearing</Button>
                  </>
                )}
                {c.status === 'EXECUTED' && <p className="text-xs text-emerald-600">Cleared at {fmtDateTime(c.executedAt as unknown as string)} — audit trail retained</p>}
              </Card>
            ))
          )}
        </div>
      )}

      <Modal open={!!takedown} onClose={() => setTakedown(null)} title="Emergency takedown (Admin only)">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">This immediately hides the message without the full clearing approval flow. The Advisor is notified and the action is audit-logged.</p>
          <Textarea label="Justification (required)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="danger" onClick={runTakedown} disabled={note.trim().length < 3} className="w-full">Remove message</Button>
        </div>
      </Modal>
    </div>
  );
}
