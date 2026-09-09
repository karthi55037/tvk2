import * as XLSX from 'xlsx';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { orm } from '@/server/db';
import { users } from '@/drizzle/schema';
import { IMPORT_COLUMNS, ROLES, VALID_BLOOD_GROUPS, AUDIT, MAX_STUDENTS } from '@/lib/constants';
import { ApiError } from '@/lib/api';
import type { AuthUser } from '@/server/auth';
import { hashPassword } from '@/server/auth';
import { audit } from '@/server/audit';
import { isValidDateStr, todayStr } from '@/lib/dates';

/**
 * Excel import pipeline (§41): Excel → validation → duplicate checking →
 * preview → import → accounts → report. Excel is NEVER the live database.
 */

export type ParsedRow = {
  index: number;
  regNo: string;
  name: string;
  dob: string;
  bloodGroup: string;
  address: string;
  mobile: string;
  errors: string[];
  existing?: boolean;
};

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date (1900 system)
    const parsed = XLSX.SSF ? null : null;
    void parsed;
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isValidDateStr(iso) ? iso : null;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

export function validateRow(row: Record<string, unknown>, index: number): ParsedRow {
  const errors: string[] = [];
  const regNo = String(row['Register Number'] ?? '').trim();
  const name = String(row['Name'] ?? '').trim();
  const dob = excelDateToISO(row['Date of Birth']);
  const bloodGroup = String(row['Blood Group'] ?? '').trim().toUpperCase();
  const address = String(row['Address'] ?? '').trim();
  const mobile = String(row['Mobile Number'] ?? '').trim();

  if (!regNo) errors.push('Register Number is required');
  else if (!/^[A-Za-z0-9\-]{3,20}$/.test(regNo)) errors.push('Register Number format is invalid');
  if (!name) errors.push('Name is required');
  else if (name.length < 2 || name.length > 80) errors.push('Name length is invalid');
  if (!dob) errors.push('Date of Birth is required (use YYYY-MM-DD, DD-MM-YYYY or a date cell)');
  else if (!isValidDateStr(dob)) errors.push('Date of Birth is not a real date');
  else if (dob > todayStr()) errors.push('Date of Birth cannot be in the future');
  if (!bloodGroup) errors.push('Blood Group is required');
  else if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) errors.push(`Blood Group must be one of ${VALID_BLOOD_GROUPS.join(', ')}`);
  if (!address) errors.push('Address is required');
  if (!mobile) errors.push('Mobile Number is required');
  else if (!/^[6-9]\d{9}$/.test(mobile.replace(/[\s-]/g, ''))) errors.push('Mobile Number must be a valid 10-digit Indian mobile number');

  return { index, regNo, name, dob: dob || '', bloodGroup, address, mobile, errors };
}

export function parseWorkbook(buffer: Buffer): { rows: ParsedRow[]; headerErrors: string[] } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw ApiError.badRequest('Could not read the file — please upload a valid .xlsx/.xls/.csv file');
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw ApiError.badRequest('The workbook has no sheets');
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false } as XLSX.Sheet2JSONOpts & { raw: false });
  const headerErrors: string[] = [];
  if (raw.length === 0) throw ApiError.badRequest('The sheet has no data rows');
  const first = raw[0];
  for (const col of IMPORT_COLUMNS) {
    if (!(col in first)) headerErrors.push(`Missing column: "${col}"`);
  }
  if (headerErrors.length) return { rows: [], headerErrors };
  if (raw.length > MAX_STUDENTS * 2) throw ApiError.badRequest(`Too many rows (max ${MAX_STUDENTS * 2})`);
  const rows = raw.map((r, i) => validateRow(r, i + 2));

  // in-file duplicate register numbers
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (seen.has(r.regNo.toLowerCase())) r.errors.push('Duplicate Register Number within the file');
    else seen.set(r.regNo.toLowerCase(), r.index);
  }
  return { rows, headerErrors: [] };
}

export type ImportPreview = {
  headerErrors: string[];
  validCount: number;
  invalidCount: number;
  updateCount: number;
  createCount: number;
  rows: Array<ParsedRow & { willUpdate: boolean }>;
};

export async function previewImport(actor: AuthUser, buffer: Buffer): Promise<ImportPreview> {
  if (actor.role !== ROLES.ADVISOR && actor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const { rows, headerErrors } = parseWorkbook(buffer);
  const regNos = rows.map((r) => r.regNo).filter(Boolean);
  const existing = regNos.length
    ? await orm.select({ regNo: users.regNo }).from(users).where(and(inArray(users.regNo, regNos), isNull(users.deletedAt)))
    : [];
  const existingSet = new Set(existing.map((e) => e.regNo?.toLowerCase()));
  const withFlags = rows.map((r) => ({ ...r, willUpdate: existingSet.has(r.regNo.toLowerCase()) }));
  return {
    headerErrors,
    validCount: withFlags.filter((r) => r.errors.length === 0).length,
    invalidCount: withFlags.filter((r) => r.errors.length > 0).length,
    updateCount: withFlags.filter((r) => r.errors.length === 0 && r.willUpdate).length,
    createCount: withFlags.filter((r) => r.errors.length === 0 && !r.willUpdate).length,
    rows: withFlags,
  };
}

export type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
  initialPasswordFormat: string;
  errors: Array<{ index: number; regNo: string; errors: string[] }>;
};

/**
 * Commit import. Safe update logic (§41): existing students are NEVER blindly
 * overwritten — only non-empty, changed fields are applied, passwords are untouched,
 * and everything is audit-logged.
 */
export async function commitImport(actor: AuthUser, buffer: Buffer): Promise<ImportReport> {
  if (actor.role !== ROLES.ADVISOR && actor.role !== ROLES.ADMIN) throw ApiError.forbidden();
  const { rows, headerErrors } = parseWorkbook(buffer);
  if (headerErrors.length) throw ApiError.badRequest(`Sheet header invalid: ${headerErrors.join('; ')}`);
  const valid = rows.filter((r) => r.errors.length === 0);
  const report: ImportReport = { created: 0, updated: 0, skipped: rows.length - valid.length, initialPasswordFormat: 'DDMMYYYY of Date of Birth', errors: [] };
  const regNos = valid.map((r) => r.regNo);
  const existing = regNos.length
    ? await orm.select().from(users).where(and(inArray(users.regNo, regNos), isNull(users.deletedAt)))
    : [];
  const existingMap = new Map(existing.map((e) => [(e.regNo || '').toLowerCase(), e]));

  for (const r of valid) {
    const prev = existingMap.get(r.regNo.toLowerCase());
    if (prev) {
      const updates: Record<string, string> = {};
      if (r.name && r.name !== prev.name) updates.name = r.name;
      if (r.dob && r.dob !== prev.dob) updates.dob = r.dob;
      if (r.bloodGroup && r.bloodGroup !== prev.bloodGroup) updates.bloodGroup = r.bloodGroup;
      if (r.address && r.address !== prev.address) updates.address = r.address;
      if (r.mobile && r.mobile !== prev.mobile) updates.mobile = r.mobile;
      if (Object.keys(updates).length > 0) {
        await orm.update(users).set({ ...updates, updatedAt: new Date() }).where(eq(users.id, prev.id));
        report.updated++;
        await audit({ actor, action: AUDIT.STUDENT_UPDATED, targetType: 'student', targetId: prev.id, metadata: { source: 'excel_import', fields: Object.keys(updates) } });
      }
    } else {
      const dobParts = r.dob.split('-'); // yyyy-mm-dd
      const initialPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`; // DDMMYYYY
      await orm.insert(users).values({
        username: r.regNo,
        regNo: r.regNo,
        name: r.name,
        dob: r.dob,
        bloodGroup: r.bloodGroup,
        address: r.address,
        mobile: r.mobile,
        role: ROLES.STUDENT,
        passwordHash: hashPassword(initialPassword),
        mustChangePassword: true,
      });
      report.created++;
      await audit({ actor, action: AUDIT.STUDENT_IMPORTED, targetType: 'student', targetId: r.regNo, metadata: { name: r.name } });
    }
  }
  for (const r of rows.filter((x) => x.errors.length > 0)) {
    report.errors.push({ index: r.index, regNo: r.regNo, errors: r.errors });
  }
  await audit({ actor, action: 'STUDENT_IMPORT_COMMIT', targetType: 'import', metadata: { created: report.created, updated: report.updated, skipped: report.skipped } });
  return report;
}
