'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, Input, Loading, Modal, Select, useToast } from '@/components/ui';
import { DAYS, DAY_NAMES, PERIODS } from '@/lib/constants';

type Slot = { dayOfWeek: number; period: number; subjectId: string | null; isLab: boolean; labName: string | null; labFloor: string | null; subjectName: string | null };
type Subject = { id: string; name: string; code: string };

export default function TimetableConsole() {
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [edit, setEdit] = useState<{ day: number; period: number; current?: Slot } | null>(null);
  const [form, setForm] = useState({ subjectId: '', isLab: false, labName: '', labFloor: '' });

  const load = useCallback(() => {
    api<{ slots: Slot[] }>('/api/timetable').then((r) => setSlots(r.slots)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ subjects: Subject[] }>('/api/subjects').then((r) => setSubjects(r.subjects)).catch(() => {});
  }, []);

  function openEdit(day: number, period: number) {
    const current = slots?.find((s) => s.dayOfWeek === day && s.period === period);
    setForm({ subjectId: current?.subjectId || '', isLab: current?.isLab || false, labName: current?.labName || '', labFloor: current?.labFloor || '' });
    setEdit({ day, period, current });
  }

  async function save() {
    if (!edit) return;
    try {
      await api('/api/timetable', {
        method: 'PUT',
        body: { dayOfWeek: edit.day, period: edit.period, subjectId: form.subjectId || null, isLab: form.isLab, labName: form.labName || null, labFloor: form.labFloor || null },
      });
      toast.push('success', 'Slot updated');
      setEdit(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function clear() {
    if (!edit) return;
    try {
      await api('/api/timetable', { method: 'DELETE', body: { dayOfWeek: edit.day, period: edit.period } });
      toast.push('success', 'Slot cleared');
      setEdit(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!slots) return <Loading />;
  const at = (d: number, p: number) => slots.find((s) => s.dayOfWeek === d && s.period === p);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Timetable editor</h1>
        <p className="text-sm text-slate-400">Click a slot to edit. Lab periods carry their own lab name & floor — the normal classroom is fixed. Period 8 is free by default.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-16 text-xs font-medium text-slate-400">Period</th>
              {DAYS.map((d) => (
                <th key={d} className="text-xs font-semibold text-slate-500">{DAY_NAMES[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="text-center text-sm font-bold text-slate-400">{p}</td>
                {DAYS.map((d) => {
                  const s = at(d, p);
                  return (
                    <td key={d}>
                      <button
                        onClick={() => openEdit(d, p)}
                        className={`h-16 w-full rounded-xl border p-1.5 text-left text-xs transition hover:border-brand-400 ${s ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'border-dashed border-slate-200 text-slate-300 dark:border-slate-800'}`}
                      >
                        {s ? (
                          <>
                            <p className="truncate font-semibold">{s.subjectName || 'Free'}</p>
                            {s.isLab ? (
                              <p className="truncate text-[10px] text-violet-500">Lab: {s.labName}{s.labFloor ? ` · ${s.labFloor}` : ''}</p>
                            ) : (
                              <p className="truncate text-[10px] text-slate-400">Classroom</p>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px]">{p === 8 ? 'free' : '—'}</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${DAY_NAMES[edit.day]} · Period ${edit.period}` : ''}>
        <div className="space-y-3">
          <Select label="Subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            <option value="">Free period</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isLab} onChange={(e) => setForm({ ...form, isLab: e.target.checked })} className="h-4 w-4 rounded" />
            This is a lab period
          </label>
          {form.isLab && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Lab name/number" value={form.labName} onChange={(e) => setForm({ ...form, labName: e.target.value })} placeholder="e.g. Lab 3" />
              <Input label="Floor" value={form.labFloor} onChange={(e) => setForm({ ...form, labFloor: e.target.value })} placeholder="e.g. 2nd" />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">Save slot</Button>
            {edit?.current && <Button variant="danger" onClick={clear}>Clear</Button>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
