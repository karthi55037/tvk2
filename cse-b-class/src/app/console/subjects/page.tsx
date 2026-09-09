'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Button, Card, Input, Loading, Modal, useToast, ConfirmButton } from '@/components/ui';
import { Plus, Pencil } from 'lucide-react';

type Subject = { id: string; name: string; code: string; facultyName: string; facultyFloor: string | null; facultyRoom: string | null };
const EMPTY = { name: '', code: '', facultyName: '', facultyFloor: '', facultyRoom: '' };

export default function SubjectsConsole() {
  const toast = useToast();
  const [rows, setRows] = useState<Subject[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ subjects: Subject[] }>('/api/subjects').then((r) => setRows(r.subjects)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function save() {
    try {
      if (editId) await api(`/api/subjects/${editId}`, { method: 'PATCH', body: form });
      else await api('/api/subjects', { method: 'POST', body: form });
      toast.push('success', editId ? 'Subject updated' : 'Subject added');
      setOpen(false);
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (!rows) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subjects ({rows.length})</h1>
        <Button onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add subject</Button>
      </div>
      <p className="text-xs text-slate-400">Lab locations live in the timetable (per period), not in the subject profile.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs font-mono text-brand-600 dark:text-brand-400">{s.code}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setForm({ name: s.name, code: s.code, facultyName: s.facultyName, facultyFloor: s.facultyFloor || '', facultyRoom: s.facultyRoom || '' }); setEditId(s.id); setOpen(true); }} aria-label={`Edit ${s.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <ConfirmButton question={`Remove ${s.name}? Timetable slots using it become free. History is retained.`} onConfirm={async () => { try { await api(`/api/subjects/${s.id}`, { method: 'DELETE' }); toast.push('success', 'Subject removed'); load(); } catch (e) { toast.push('error', (e as Error).message); } }}>
                  ×
                </ConfirmButton>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">{s.facultyName}</p>
            <p className="text-xs text-slate-400">{s.facultyFloor ? `Floor ${s.facultyFloor} · ` : ''}{s.facultyRoom || ''}</p>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit subject' : 'Add subject'}>
        <div className="space-y-3">
          <Input label="Subject name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Subject code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editId} />
          <Input label="Faculty name" value={form.facultyName} onChange={(e) => setForm({ ...form, facultyName: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Faculty floor" value={form.facultyFloor} onChange={(e) => setForm({ ...form, facultyFloor: e.target.value })} />
            <Input label="Cabin / room no." value={form.facultyRoom} onChange={(e) => setForm({ ...form, facultyRoom: e.target.value })} />
          </div>
          <Button onClick={save} disabled={!form.name || !form.code || !form.facultyName} className="w-full">Save</Button>
        </div>
      </Modal>
    </div>
  );
}
