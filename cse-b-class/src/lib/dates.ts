/** College-local date helpers. All date-only values are 'yyyy-mm-dd' strings in APP_TZ. */
const TZ = process.env.APP_TZ || 'Asia/Kolkata';

export function nowInTz(): Date {
  return new Date();
}

function parts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year!, m: p.month!, d: p.day!, weekday: p.weekday! };
}

/** yyyy-mm-dd for "today" in college timezone */
export function todayStr(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const { y, m, d: dd } = parts(d);
  return `${y}-${m}-${dd}`;
}

export function tomorrowStr(): string {
  return todayStr(1);
}

/** Day of week 1=Mon..6=Sat, 0=Sun for a yyyy-mm-dd string */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return js; // keep 0=Sun convention for display mapping
}

export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function fmtDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, dateStyle: 'medium' }).format(date);
}

export function fmtTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, timeStyle: 'short' }).format(date);
}
