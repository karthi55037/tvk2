'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, Input, Loading, Modal, Select, StatusPill, Textarea, useToast, ConfirmButton } from '@/components/ui';
import { STATUS_TONE } from '@/lib/format';
import { Plus } from 'lucide-react';

type Subject = { id: string; name: string; code: string; experiments: { id: string; number: number; name: string }[] };
type Completion = { userId: string; name: string; regNo: string | null; completion: string | null; recordStatus: string | null; recordFileId: string | null };

export default function ExperimentsConsole() {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', number: '', name: '', details: '', instructions: '', requiredFilesNote: '' });
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null);
  const [completions, setCompletions] = useState<Completion[] | null>(null);

  const load = useCallback(() => {
    api<{ subjects: Subject[] }>('/api/experiments').then((r) => setSubjects(r.subjects)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function openExperiment(exp: { id: string; name: string }) {
    setViewing(exp);
    try {
      const c = await api<{ completions: Completion[] }>(`/api/experiments/${exp.id}/completion`);
      setCompletions(c.completions);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function create() {
    try {
      await api('/api/experiments', {
        method: 'POST',
        body: { subjectId: form.subjectId, name: form.name, details: form.details || undefined, instructions: form.instructions || undefined, requiredFilesNote: form.requiredFilesNote || undefined, number: form.number ? Number(form.number) : undefined },
      });
      toast.push('success', 'Experiment added');
      setOpen(false);
      setForm({ subjectId: '', number: '', name: '', details: '', instructions: '', requiredFilesNote: '' });
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function verifyRecord(studentId: string, decision: 'VERIFIED' | 'REJECTED') {
    if (!viewing) return;
    try {
      await api(`/api/experiments/${viewing.id}/record`, { method: 'PUT', body: { studentId, decision } });
      toast.push('success', decision === 'VERIFIED' ? 'Verified' : 'Rejected');
      openExperiment(viewing);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function setCompletion(studentId: string, status: 'COMPLETED' | 'NOT_COMPLETED') {
    if (!viewing) return;
    try {
      await api(`/api/experiments/${viewing.id}/completion`, { method: 'POST', body: { userId: studentId, status } });
      openExperiment(viewing);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!subjects) return <Loading />;
  const active = subjects.filter((s) => s.experiments.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Record & Observation</h1>
          <p className="text-sm text-slate-400">Organized by Subject → Experiments — never Record 1..N.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add experiment</Button>
      </div>

      {active.length === 0 && <Card className="p-8 text-center text-sm text-slate-400">No experiments yet. Add the first one to a subject.</Card>}
      {active.map((s) => (
        <Card key={s.id} className="p-4">
          <p className="font-semibold">{s.name} <span className="ml-1 text-xs font-mono text-brand-600">{s.code}</span></p>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {s.experiments.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <p className="text-sm">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600 dark:bg-violet-500/10">{e.number}</span>
                  {e.name}
                </p>
                <Button size="sm" variant="secondary" onClick={() => openExperiment(e)}>Verify / manage</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} title="Add experiment" wide>
        <div className="space-y-3">
          <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Number (auto if empty)" type="number" min={1} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            <div className="col-span-2">
              <Input label="Experiment name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <Textarea label="Details" rows={2} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          <Textarea label="Instructions" rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          <Input label="Required files note" value={form.requiredFilesNote} onChange={(e) => setForm({ ...form, requiredFilesNote: e.target.value })} />
          <Button onClick={create} disabled={!form.subjectId || form.name.length < 2} className="w-full">Add experiment</Button>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? viewing.name : ''} wide>
        {!completions ? (
          <Loading />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-2">Student</th>
                  <th className="py-2">Completion</th>
                  <th className="py-2">Record</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {completions.map((c) => (
                  <tr key={c.userId} className="border-t border-slate-50 dark:border-slate-800/50">
                    <td className="py-2">{c.name} <span className="text-xs text-slate-400">{c.regNo}</span></td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant={c.completion === 'COMPLETED' ? 'success' : 'secondary'} onClick={() => setCompletion(c.userId, 'COMPLETED')}>✓</Button>
                        <Button size="sm" variant={c.completion === 'NOT_COMPLETED' ? 'danger' : 'secondary'} onClick={() => setCompletion(c.userId, 'NOT_COMPLETED')}>✗</Button>
                      </div>
                    </td>
                    <td className="py-2">
                      {c.recordStatus ? (
                        <div className="flex items-center gap-1.5">
                          <StatusPill value={c.recordStatus} tone={STATUS_TONE} />
                          {c.recordFileId && <a href={`/api/files/${c.recordFileId}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">file</a>}
                        </div>
                      ) : (
                        <Badge tone="gray">none</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {c.recordStatus === 'PENDING' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="success" onClick={() => verifyRecord(c.userId, 'VERIFIED')}>Verify</Button>
                          <Button size="sm" variant="danger" onClick={() => verifyRecord(c.userId, 'REJECTED')}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
