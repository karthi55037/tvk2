'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { Badge, Button, Card, Input, Loading, Modal, useToast } from '@/components/ui';
import { useAuth } from '@/components/providers';
import { Download, KeyRound, Pencil, Upload } from 'lucide-react';

type Row = { id: string; name: string; regNo: string | null; mobile: string | null; bloodGroup?: string | null; dob?: string | null; address?: string | null; role: string };
type PreviewRow = { index: number; regNo: string; name: string; dob: string; bloodGroup: string; address: string; mobile: string; errors: string[]; willUpdate: boolean };
type Preview = { headerErrors: string[]; validCount: number; invalidCount: number; updateCount: number; createCount: number; rows: PreviewRow[] };
type Report = { created: number; updated: number; skipped: number; initialPasswordFormat: string; errors: { index: number; regNo: string; errors: string[] }[] };

export default function StudentsConsole() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canImport = user?.role === 'ADVISOR' || user?.role === 'ADMIN';
  const canEditAll = user?.role === 'ADVISOR';

  const load = useCallback(() => {
    api<{ students: Row[] }>('/api/students').then((r) => setRows(r.students)).catch((e) => toast.push('error', e.message));
  }, [toast]);
  useEffect(load, [load]);

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/api/students/${editing.id}`, {
        method: 'PATCH',
        body: {
          name: editing.name || undefined,
          mobile: editing.mobile || undefined,
          bloodGroup: editing.bloodGroup || undefined,
          address: editing.address || undefined,
          dob: editing.dob || undefined,
        },
      });
      toast.push('success', 'Student updated (audit-logged)');
      setEditing(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, name: string) {
    if (!window.confirm(`Issue a one-time temporary password for ${name}? Share it only through a verified channel.`)) return;
    try {
      const r = await api<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`, { method: 'POST' });
      toast.push('success', `Temp password: ${r.temporaryPassword} (shown once)`);
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function runPreview() {
    if (!file) return;
    setBusy(true);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const p = await api<Preview>('/api/import/preview', { method: 'POST', formData: fd });
      setPreview(p);
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api<Report>('/api/import/commit', { method: 'POST', formData: fd });
      setReport(r);
      setPreview(null);
      load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const csv = 'Register Number,Name,Date of Birth,Blood Group,Address,Mobile Number\nCB22051,Ananya Sharma,2006-04-12,O+,12 MG Road, Bangalore 560001,9876543210\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cseb-students-template.csv';
    a.click();
  }

  if (!rows) return <Loading />;
  const filtered = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.regNo || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Students ({rows.length})</h1>
        <div className="flex gap-2">
          {canImport && (
            <>
              <Button variant="secondary" onClick={downloadTemplate}><Download className="h-4 w-4" /> Template</Button>
              <Button onClick={() => { setImportOpen(true); setPreview(null); setReport(null); setFile(null); }}><Upload className="h-4 w-4" /> Import Excel</Button>
            </>
          )}
        </div>
      </div>
      <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <th className="px-4 py-3">Reg No</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Blood</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 dark:border-slate-800/50 dark:hover:bg-slate-800/30">
                <td className="px-4 py-2.5 font-mono text-xs">{r.regNo}</td>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.mobile}</td>
                <td className="px-4 py-2.5">{r.bloodGroup}</td>
                <td className="px-4 py-2.5">{r.role === 'REPRESENTATIVE' ? <Badge tone="brand">Rep</Badge> : <span className="text-xs text-slate-400">Student</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  {canEditAll && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(r.id, r.name)} aria-label={`Reset password for ${r.name}`}><KeyRound className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No students.</p>}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name || ''}`} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Register number" value={editing.regNo || ''} disabled />
              <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input label="DOB" type="date" value={editing.dob || ''} onChange={(e) => setEditing({ ...editing, dob: e.target.value })} />
              <Input label="Blood group" value={editing.bloodGroup || ''} onChange={(e) => setEditing({ ...editing, bloodGroup: e.target.value })} />
              <Input label="Mobile" value={editing.mobile || ''} onChange={(e) => setEditing({ ...editing, mobile: e.target.value })} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Address</span>
              <textarea rows={2} value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <p className="text-xs text-slate-400">Every advisor edit is recorded in the audit log.</p>
            <Button onClick={saveEdit} loading={busy} className="w-full">Save changes</Button>
          </div>
        )}
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import students from Excel" wide>
        <div className="space-y-4">
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-slate-500">
            <li>Required columns: Register Number, Name, Date of Birth, Blood Group, Address, Mobile Number</li>
            <li>Date of Birth accepts YYYY-MM-DD, DD-MM-YYYY or real date cells</li>
            <li>Preview validates everything — invalid rows are never imported</li>
            <li>New students get initial password = DOB (DDMMYYYY) and must change it at first login</li>
            <li>Existing students: only non-empty changed fields update; passwords are never overwritten</li>
          </ol>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}
            className="block w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700"
          />
          <div className="flex gap-2">
            <Button onClick={runPreview} loading={busy} disabled={!file} variant="secondary">Validate & preview</Button>
            <Button onClick={runCommit} loading={busy} disabled={!file || !preview || preview.validCount === 0}>Import {preview ? `${preview.validCount} valid` : ''}</Button>
          </div>

          {preview && (
            <div className="space-y-2">
              {preview.headerErrors.length > 0 && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">{preview.headerErrors.join(' · ')}</p>}
              <div className="flex gap-2 text-xs">
                <Badge tone="green">{preview.createCount} to create</Badge>
                <Badge tone="blue">{preview.updateCount} to update</Badge>
                <Badge tone="red">{preview.invalidCount} invalid</Badge>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs">
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.index} className={`border-b border-slate-50 dark:border-slate-800/50 ${r.errors.length ? 'bg-rose-50/60 dark:bg-rose-500/5' : ''}`}>
                        <td className="px-2 py-1.5 font-mono">{r.regNo}</td>
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.dob}</td>
                        <td className="px-2 py-1.5">{r.willUpdate ? 'update' : 'new'}</td>
                        <td className="px-2 py-1.5 text-rose-600 dark:text-rose-400">{r.errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">Import complete</p>
              <p className="mt-1 text-emerald-700/80 dark:text-emerald-400/80">
                Created {report.created} · Updated {report.updated} · Skipped {report.skipped}. Initial password: DOB as DDMMYYYY.
                {report.errors.length > 0 && ` ${report.errors.length} rows had errors and were skipped.`}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
