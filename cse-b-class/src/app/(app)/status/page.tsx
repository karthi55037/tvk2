'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, onRealtime } from '@/lib/client';
import { TopBar } from '@/components/nav';
import { Badge, Button, Card, Input, Loading, Select, StatusPill, Tabs, Textarea, useToast } from '@/components/ui';
import { DAILY_STATUS_LABEL } from '@/lib/format';
import { STATUS_TONE } from '@/lib/format';
import { todayStr, tomorrowStr, fmtTime } from '@/lib/dates';
import { DoorOpen, LogIn } from 'lucide-react';
import { useAuth } from '@/components/providers';

type MyStatus = { date: string; status: string; halfDayPart: string | null };

type OutRecord = {
  id: string;
  userId: string;
  name: string;
  regNo: string | null;
  destination: string;
  reason?: string; // present only for advisor/representative (§11)
  outAt: string;
  expectedReturnAt: string;
  status: string;
};

export default function StatusPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('today');
  const [statuses, setStatuses] = useState<MyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [status, setStatus] = useState('PRESENT');
  const [reason, setReason] = useState('');
  const [halfPart, setHalfPart] = useState('FIRST');
  const [halfTime, setHalfTime] = useState('');
  const [targetDate, setTargetDate] = useState(todayStr());

  // out-of-class
  const [mine, setMine] = useState<OutRecord['destination'] extends never ? never : OutRecord | null>(null);
  const [outRecords, setOutRecords] = useState<OutRecord[]>([]);
  const [destination, setDestination] = useState('');
  const [outReason, setOutReason] = useState('');
  const [expected, setExpected] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([
        api<{ statuses: MyStatus[] }>('/api/status/daily'),
        api<{ records: OutRecord[]; mine: OutRecord | null }>('/api/status/out-of-class'),
      ]);
      setStatuses(d.statuses);
      setOutRecords(o.records.filter((r) => r.status === 'OUT'));
      setMine(o.mine);
      const existing = d.statuses.find((s) => s.date === targetDate);
      if (existing) {
        setStatus(existing.status);
        setHalfPart(existing.halfDayPart || 'FIRST');
      }
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [targetDate, toast]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onRealtime('out_of_class', load), [load]);

  const activeDate = tab === 'today' ? todayStr() : tomorrowStr();
  const saved = statuses.find((s) => s.date === activeDate);

  function pickStatus(s: string) {
    setStatus(s);
    const existing = statuses.find((x) => x.date === activeDate);
    if (!existing || existing.status !== s) {
      setReason('');
      setHalfTime('');
    }
  }

  async function saveDaily() {
    if (!confirmDaily()) return;
    setSaving(true);
    try {
      await api('/api/status/daily', {
        method: 'POST',
        body: { date: activeDate, status, reason: reason || undefined, halfDayPart: status === 'HALF_DAY' ? halfPart : undefined, halfDayTime: halfTime || undefined },
      });
      toast.push('success', 'Status saved');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDaily(): boolean {
    if (status === 'LATE' && !reason.trim()) {
      toast.push('error', 'A reason is mandatory when marking Late');
      return false;
    }
    if (status === 'NOT_COMING' && !reason.trim()) {
      return window.confirm('No reason given for "Not Coming". Save anyway?');
    }
    if (status === 'HALF_DAY' && !reason.trim()) {
      toast.push('error', 'Please describe the half-day details');
      return false;
    }
    return true;
  }

  async function goOut() {
    if (!destination.trim() || !outReason.trim() || !expected) {
      toast.push('error', 'Fill where you are going, the reason and expected return time');
      return;
    }
    try {
      await api('/api/status/out-of-class', {
        method: 'POST',
        body: { destination, reason: outReason, expectedReturnAt: new Date(expected).toISOString() },
      });
      toast.push('success', 'Marked out of class');
      setDestination('');
      setOutReason('');
      setExpected('');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function goBack() {
    try {
      await api('/api/status/out-of-class/back', { method: 'POST' });
      toast.push('success', 'Welcome back!');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  async function clearOut(id: string) {
    try {
      await api(`/api/status/out-of-class/${id}/clear`, { method: 'POST' });
      toast.push('success', 'Out-of-class status cleared');
      await load();
    } catch (e) {
      toast.push('error', (e as Error).message);
    }
  }

  if (loading) return <Loading />;
  const canSeeReason = user?.role === 'ADVISOR' || user?.role === 'REPRESENTATIVE';

  return (
    <>
      <TopBar title="Status" />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Tabs
          tabs={[
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'out', label: 'Out of Class' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab !== 'out' ? (
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Daily status — {tab === 'today' ? 'Today' : 'Tomorrow'} ({activeDate})</p>
              {saved && <StatusPill value={saved.status} label={DAILY_STATUS_LABEL[saved.status]} tone={STATUS_TONE} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['PRESENT', 'NOT_COMING', 'LATE', 'HALF_DAY'].map((s) => (
                <button
                  key={s}
                  onClick={() => pickStatus(s)}
                  className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition ${
                    status === s
                      ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {DAILY_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {status === 'HALF_DAY' && (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Which half?" value={halfPart} onChange={(e) => setHalfPart(e.target.value)}>
                  <option value="FIRST">First Half</option>
                  <option value="SECOND">Second Half</option>
                </Select>
                <Input label="Specific time (optional)" placeholder="e.g. 11:30" value={halfTime} onChange={(e) => setHalfTime(e.target.value)} />
              </div>
            )}
            {status !== 'PRESENT' && (
              <Textarea
                label={`Reason ${status === 'LATE' ? '(mandatory)' : status === 'NOT_COMING' ? '(optional)' : '(details, required)'}`}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder={status === 'LATE' ? 'Why will you be late?' : status === 'HALF_DAY' ? 'Details about your half day' : 'Optional reason'}
              />
            )}
            <Button onClick={saveDaily} loading={saving} className="w-full">
              Save status for {tab}
            </Button>
            <p className="text-center text-[11px] text-slate-400">Daily status is separate from Leave/OD. Leave and OD are under More.</p>
          </Card>
        ) : (
          <>
            {mine ? (
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold"><DoorOpen className="h-4 w-4 text-amber-500" /> You are out of class</p>
                  <Badge tone="amber">{fmtTime(mine.outAt)}</Badge>
                </div>
                <p className="text-sm">Destination: <b>{mine.destination}</b></p>
                <p className="text-xs text-slate-500">Expected back by {fmtTime(mine.expectedReturnAt)}</p>
                <Button variant="success" onClick={goBack} className="w-full">
                  <LogIn className="h-4 w-4" /> I&apos;m Back
                </Button>
              </Card>
            ) : user?.role === 'STUDENT' || user?.role === 'REPRESENTATIVE' ? (
              <Card className="space-y-3 p-4">
                <p className="text-sm font-semibold">Going out of class?</p>
                <Input label="Where are you going?" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Main office, Lab 2, Washroom" maxLength={120} />
                <Textarea label="Reason (visible only to Advisor & Representatives)" rows={2} value={outReason} onChange={(e) => setOutReason(e.target.value)} maxLength={500} />
                <Input label="Expected return time" type="datetime-local" value={expected} onChange={(e) => setExpected(e.target.value)} />
                <Button onClick={goOut} className="w-full">
                  <DoorOpen className="h-4 w-4" /> Mark out of class
                </Button>
                <p className="text-center text-[11px] text-slate-400">Your name and times are visible to the class — your reason is not (except Advisor/Reps).</p>
              </Card>
            ) : null}

            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Currently out ({outRecords.length})</h2>
              {outRecords.length === 0 ? (
                <p className="py-3 text-center text-sm text-slate-400">No one is out right now.</p>
              ) : (
                <ul className="space-y-2">
                  {outRecords.map((r) => (
                    <li key={r.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{r.name}</p>
                        {canSeeReason && r.reason ? <Badge tone="blue">reason visible to staff</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.destination} · out {fmtTime(r.outAt)} · back by {fmtTime(r.expectedReturnAt)}
                      </p>
                      {canSeeReason && r.reason && <p className="mt-1 text-xs italic text-slate-500">Reason: {r.reason}</p>}
                      {canSeeReason && (
                        <Button size="sm" variant="secondary" className="mt-2" onClick={() => clearOut(r.id)}>
                          Clear status
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}
