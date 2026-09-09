'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { fmtDateTime } from '@/lib/dates';
import { Plus } from 'lucide-react';

type Visit = {
  id: string;
  studentId: string;
  studentName: string;
  regNo: string | null;
  teacherName: string;
  location: string;
  reason: string;
  outAt: string;
  expectedReturnAt: string;
  returnStatus: string;
  returnedAt: string | null;
};

export default function VisitsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; regNo: string | null }[]>([]);
  const [form, setForm] = useState({ studentId: '', teacherName: '', location: '', reason: '', outAt: '', expectedReturnAt: '' });
  const canCreate = user?.role === 'REPRESENTATIVE' || user?.role === 'ADVISOR' || user?.role === 'ADMIN';

  const load = useCallback(() => {
    api<{ visits: Visit[] }>('/api/visits').then((r) => setVisits(r.visits)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);
  useEffect(() => {
    if (canCreate) api<{ students: { id: string; name: string; regNo: string | null }[] }>('/api/students').then((r) => setStudents(r.students)).catch(() => {});
  }, [canCreate]);

  async function create() {
    try {
      await api('/api/visits', { method: 'POST', body: { ...form, outAt: new Date(form.outAt).toISOString(), expectedReturnAt: new Date(form.expectedReturnAt).toISOString() } });
      toast.push('success', 'Visit recorded — student notified');
      setOpen(false);
      setForm({ studentId: '', teacherName: '', location: '', reason: '', outAt: '', expectedReturnAt: '' });
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function markReturn(id: string) {
    try {
      await api(`/api/visits/${id}/return`, { method: 'POST' });
      toast.push('success', 'Marked returned');
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!visits) return <Loading />;

  return (
    <>
      <TopBar title="Teacher Visits" />
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {canCreate && (
          <Button onClick={() => setOpen(true)} className="w-full">
            <Plus className="h-4 w-4" /> Record a teacher visit
          </Button>
        )}
        {visits.length === 0 && (
          <Card>
            <EmptyState title="No visit records" subtitle={canCreate ? 'Create records when a teacher takes a student out of class.' : 'Records about you will appear here — only you, the Advisor and Representatives can see them.'} />
          </Card>
        )}
        {visits.map((v) => (
          <Card key={v.id} className="space-y-1.5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{v.teacherName}</p>
              <Badge tone={v.returnStatus === 'RETURNED' ? 'green' : 'amber'}>{v.returnStatus === 'RETURNED' ? 'Returned' : 'Out'}</Badge>
            </div>
            {canCreate && <p className="text-xs text-slate-500">Student: {v.studentName} ({v.regNo})</p>}
            <p className="text-xs text-slate-500">{v.location} · {v.reason}</p>
            <p className="text-[11px] text-slate-400">
              Left {fmtDateTime(v.outAt)} · expected back {fmtDateTime(v.expectedReturnAt)}
              {v.returnedAt ? ` · returned ${fmtDateTime(v.returnedAt)}` : ''}
            </p>
            {canCreate && v.returnStatus === 'OUT' && (
              <Button size="sm" variant="secondary" onClick={() => markReturn(v.id)}>Mark returned</Button>
            )}
          </Card>
        ))}
        <p className="pb-2 text-center text-[11px] text-slate-400">Private: visible only to the Advisor, Representatives, and the student involved.</p>
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="Record teacher visit">
        <div className="space-y-3">
          <Select label="Student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.regNo})</option>
            ))}
          </Select>
          <Input label="Teacher name" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} maxLength={100} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} />
          <Textarea label="Reason / purpose" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Leaving time" type="datetime-local" value={form.outAt} onChange={(e) => setForm({ ...form, outAt: e.target.value })} />
            <Input label="Expected return" type="datetime-local" value={form.expectedReturnAt} onChange={(e) => setForm({ ...form, expectedReturnAt: e.target.value })} />
          </div>
          <Button onClick={create} disabled={!form.studentId || !form.teacherName || !form.outAt || !form.expectedReturnAt} className="w-full">Create record</Button>
        </div>
      </Modal>
    </>
  );
}
