import { ROLES, type Role } from '@/lib/constants';
import type { AuthUser } from '@/server/auth';

/**
 * Central authorization matrix (§35: never trust the client — every check here is
 * enforced server-side in the service layer; UI merely mirrors it).
 */

export const isStaff = (u: { role: Role }) => u.role !== ROLES.STUDENT;

const oneOf = (...roles: Role[]) => (u: AuthUser) => roles.includes(u.role);

export const can = {
  manageSubjects: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  manageTimetable: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  createAnnouncement: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  deleteAnnouncement: oneOf(ROLES.ADVISOR, ROLES.ADMIN), // creators handled in service
  manageAssignments: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  manageExperiments: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  verifyResource: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  verifyRecord: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  setAnySubmission: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  decideLeave: oneOf(ROLES.ADVISOR), // ONLY advisor approves/rejects leave (§14)
  decideOD: oneOf(ROLES.ADVISOR), // ONLY advisor approves/rejects OD (§15)
  confirmLetter: oneOf(ROLES.REPRESENTATIVE), // any ONE rep confirms (§14/§15)
  viewOutOfClassReason: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE),
  clearOutOfClass: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE),
  createTeacherVisit: oneOf(ROLES.REPRESENTATIVE, ROLES.ADVISOR, ROLES.ADMIN),
  createMeeting: oneOf(ROLES.ADVISOR),
  reportChat: oneOf(ROLES.REPRESENTATIVE, ROLES.ADVISOR, ROLES.ADMIN),
  resolveReport: oneOf(ROLES.ADVISOR, ROLES.ADMIN),
  requestClearing: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  approveClearing: oneOf(ROLES.ADVISOR, ROLES.REPRESENTATIVE, ROLES.ADMIN),
  emergencyTakedown: oneOf(ROLES.ADMIN), // documented emergency mechanism (§19)
  viewAudit: oneOf(ROLES.ADVISOR, ROLES.ADMIN),
  manageRoles: oneOf(ROLES.ADVISOR, ROLES.ADMIN),
  addRepresentative: oneOf(ROLES.ADVISOR, ROLES.ADMIN, ROLES.REPRESENTATIVE), // §7
  removeRepresentative: oneOf(ROLES.ADVISOR, ROLES.ADMIN, ROLES.REPRESENTATIVE), // §7
  setAdvisor: oneOf(ROLES.REPRESENTATIVE, ROLES.ADMIN), // §7
  manageAdmins: oneOf(ROLES.ADMIN),
  importStudents: oneOf(ROLES.ADVISOR, ROLES.ADMIN), // §41
  editStudentFull: oneOf(ROLES.ADVISOR), // advisor edits any student's info (§9)
  manageSettings: oneOf(ROLES.ADMIN),
};

/** Student directory visibility (§9): students see limited fields of others. */
export const DIRECTORY_FIELDS: Record<Role, string[]> = {
  [ROLES.STUDENT]: ['name', 'regNo', 'mobile'],
  [ROLES.REPRESENTATIVE]: ['name', 'regNo', 'mobile', 'bloodGroup'], // "other permitted details" — minimal extra, documented
  [ROLES.ADVISOR]: ['name', 'regNo', 'mobile', 'bloodGroup', 'dob', 'address', 'email'],
  [ROLES.ADMIN]: ['name', 'regNo', 'mobile'],
};

export function pickDirectoryFields(
  user: { name: string; regNo: string | null; mobile: string | null; bloodGroup: string | null; dob: string | null; address: string | null; email: string | null },
  viewerRole: Role,
) {
  const allowed = DIRECTORY_FIELDS[viewerRole] || DIRECTORY_FIELDS[ROLES.STUDENT];
  const full: Record<string, unknown> = {
    name: user.name,
    regNo: user.regNo,
    mobile: user.mobile,
    bloodGroup: user.bloodGroup,
    dob: user.dob,
    address: user.address,
    email: user.email,
  };
  const out: Record<string, unknown> = {};
  for (const k of allowed) out[k] = full[k];
  return out;
}
