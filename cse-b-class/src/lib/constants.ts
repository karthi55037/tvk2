// ---------------------------------------------------------------- roles
export const ROLES = {
  STUDENT: 'STUDENT',
  REPRESENTATIVE: 'REPRESENTATIVE',
  ADVISOR: 'ADVISOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MAX_REPRESENTATIVES = 4;
export const MAX_STUDENTS = 200;

// ---------------------------------------------------------------- roles hierarchy (§7)
export const STAFF: Role[] = [ROLES.REPRESENTATIVE, ROLES.ADVISOR, ROLES.ADMIN];

// ---------------------------------------------------------------- daily status (§10)
export const DAILY_STATUSES = ['PRESENT', 'NOT_COMING', 'LATE', 'HALF_DAY'] as const;
export type DailyStatusValue = (typeof DAILY_STATUSES)[number];
export const HALF_DAY_PARTS = ['FIRST', 'SECOND'] as const;

// ---------------------------------------------------------------- leave workflow (§14)
export const LEAVE_STATUSES = [
  'PENDING',
  'APPROVED', // advisor approved — letter pending upload (kept distinct per spec)
  'LETTER_PENDING',
  'LETTER_POSTED',
  'REP_CONFIRMED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// ---------------------------------------------------------------- od workflow (§15)
export const OD_STATUSES = [
  'PENDING',
  'APPROVED', // advisor approved — letter required (kept distinct per spec)
  'LETTER_REQUIRED',
  'LETTER_POSTED',
  'REP_CONFIRMED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ODStatus = (typeof OD_STATUSES)[number];

// ---------------------------------------------------------------- resources (§22)
export const RESOURCE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const REPORT_CATEGORIES = ['ABUSE', 'SPAM', 'INCORRECT', 'PRIVATE_INFO', 'OTHER'] as const;

// ---------------------------------------------------------------- chat
export const THREAD_TYPES = ['CLASS', 'ASSIGNMENT', 'EXPERIMENT'] as const;
export type ThreadType = (typeof THREAD_TYPES)[number];
export const CLASS_THREAD = 'class';
// Class chat is text-only — no emojis/stickers (§17)
export const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{E000}-\u{F8FF}]/u;

// ---------------------------------------------------------------- timetable (§12)
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAYS = [1, 2, 3, 4, 5, 6] as const;
export const DEFAULT_CLASSROOM = 'Main Classroom';

// ---------------------------------------------------------------- notifications (§31)
export const NOTIFICATION_CATEGORIES = [
  'ANNOUNCEMENT',
  'ASSIGNMENT_NEW',
  'ASSIGNMENT_UPDATED',
  'RESOURCE_APPROVED',
  'RESOURCE_REJECTED',
  'STATUS_ALERT',
  'OUT_OF_CLASS',
  'LEAVE_SUBMITTED',
  'LEAVE_DECIDED',
  'LEAVE_LETTER_POSTED',
  'LEAVE_LETTER_CONFIRMED',
  'LEAVE_WITHDRAW_REQUESTED',
  'OD_SUBMITTED',
  'OD_DECIDED',
  'OD_LETTER_POSTED',
  'OD_LETTER_CONFIRMED',
  'OD_WITHDRAW_REQUESTED',
  'VISIT_CREATED',
  'PROFILE_UPDATED',
  'MEETING_REQUEST',
  'CHAT_MESSAGE',
  'REPORT_SUBMITTED',
  'CLEARING_REQUEST',
  'CLEARING_EXECUTED',
  'EXPERIMENT_VERIFIED',
  'SUBMISSION_MARKED',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_LABELS: Record<string, string> = {
  ANNOUNCEMENT: 'New announcements',
  ASSIGNMENT_NEW: 'New assignments',
  ASSIGNMENT_UPDATED: 'Assignment updates',
  RESOURCE_APPROVED: 'Resource approvals',
  RESOURCE_REJECTED: 'Resource rejections',
  STATUS_ALERT: 'Student status alerts',
  OUT_OF_CLASS: 'Students going out of class',
  LEAVE_SUBMITTED: 'Leave requests submitted',
  LEAVE_DECIDED: 'Leave approved / rejected',
  LEAVE_LETTER_POSTED: 'Leave letters posted',
  LEAVE_LETTER_CONFIRMED: 'Leave letters confirmed',
  LEAVE_WITHDRAW_REQUESTED: 'Leave withdrawal requests',
  OD_SUBMITTED: 'OD requests submitted',
  OD_DECIDED: 'OD approved / rejected',
  OD_LETTER_POSTED: 'OD letters posted',
  OD_LETTER_CONFIRMED: 'OD letters confirmed',
  OD_WITHDRAW_REQUESTED: 'OD withdrawal requests',
  VISIT_CREATED: 'Teacher visit records',
  PROFILE_UPDATED: 'Student profile updates',
  MEETING_REQUEST: 'Advisor meeting requests',
  CHAT_MESSAGE: 'New class-group chat messages',
  REPORT_SUBMITTED: 'Reports submitted to Advisor',
  CLEARING_REQUEST: 'Chat clearing requests',
  CLEARING_EXECUTED: 'Chat clearing executed',
  EXPERIMENT_VERIFIED: 'Experiment record verifications',
  SUBMISSION_MARKED: 'Assignment submission changes',
};

// ---------------------------------------------------------------- audience helpers (privacy-aware)
export function usersToNotifyForCategory(category: NotificationCategory): 'ADVISOR' | 'REPS_AND_ADVISOR' | 'ALL' {
  switch (category) {
    case 'LEAVE_SUBMITTED':
    case 'OD_SUBMITTED':
    case 'REPORT_SUBMITTED':
    case 'LEAVE_WITHDRAW_REQUESTED':
    case 'OD_WITHDRAW_REQUESTED':
    case 'PROFILE_UPDATED':
      return 'ADVISOR';
    case 'OUT_OF_CLASS':
      return 'REPS_AND_ADVISOR';
    default:
      return 'ALL';
  }
}

// ---------------------------------------------------------------- file modules (§39)
export const FILE_MODULES = ['LEAVE', 'OD', 'ASSIGNMENT', 'EXPERIMENT', 'CHAT', 'ANNOUNCEMENT', 'IMPORT'] as const;
export type FileModule = (typeof FILE_MODULES)[number];

export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/json',
]);

// ---------------------------------------------------------------- import (§41)
export const IMPORT_COLUMNS = ['Register Number', 'Name', 'Date of Birth', 'Blood Group', 'Address', 'Mobile Number'];
export const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ---------------------------------------------------------------- audit (§40)
export const AUDIT = {
  LOGIN: 'AUTH_LOGIN',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  PASSWORD_RESET: 'AUTH_PASSWORD_RESET',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  ROLE_REP_ADDED: 'ROLE_REPRESENTATIVE_ADDED',
  ROLE_REP_REMOVED: 'ROLE_REPRESENTATIVE_REMOVED',
  ROLE_ADVISOR_SET: 'ROLE_ADVISOR_SET',
  ROLE_ADVISOR_REMOVED: 'ROLE_ADVISOR_REMOVED',
  ROLE_ADMIN_ADDED: 'ROLE_ADMIN_ADDED',
  ROLE_ADMIN_REMOVED: 'ROLE_ADMIN_REMOVED',
  PROFILE_UPDATED_SELF: 'PROFILE_UPDATED_SELF',
  PROFILE_UPDATED_BY_ADVISOR: 'PROFILE_UPDATED_BY_ADVISOR',
  STUDENT_IMPORTED: 'STUDENT_IMPORTED',
  STUDENT_UPDATED: 'STUDENT_UPDATED',
  SUBJECT_CREATED: 'SUBJECT_CREATED',
  SUBJECT_UPDATED: 'SUBJECT_UPDATED',
  SUBJECT_REMOVED: 'SUBJECT_REMOVED',
  TIMETABLE_UPDATED: 'TIMETABLE_UPDATED',
  DAILY_STATUS_SET: 'DAILY_STATUS_SET',
  OUT_OF_CLASS_MARKED: 'OUT_OF_CLASS_MARKED',
  OUT_OF_CLASS_RETURNED: 'OUT_OF_CLASS_RETURNED',
  OUT_OF_CLASS_CLEARED: 'OUT_OF_CLASS_CLEARED',
  LEAVE_SUBMITTED: 'LEAVE_SUBMITTED',
  LEAVE_DECIDED: 'LEAVE_DECIDED',
  LEAVE_WITHDRAWN: 'LEAVE_WITHDRAWN',
  LEAVE_LETTER_POSTED: 'LEAVE_LETTER_POSTED',
  LEAVE_LETTER_CONFIRMED: 'LEAVE_LETTER_CONFIRMED',
  OD_SUBMITTED: 'OD_SUBMITTED',
  OD_DECIDED: 'OD_DECIDED',
  OD_WITHDRAWN: 'OD_WITHDRAWN',
  OD_LETTER_POSTED: 'OD_LETTER_POSTED',
  OD_LETTER_CONFIRMED: 'OD_LETTER_CONFIRMED',
  ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
  ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
  CHAT_MESSAGE_POSTED: 'CHAT_MESSAGE_POSTED',
  CHAT_MESSAGE_CLEARED: 'CHAT_MESSAGE_CLEARED',
  CHAT_EMERGENCY_TAKEDOWN: 'CHAT_EMERGENCY_TAKEDOWN',
  CHAT_REPORTED: 'CHAT_REPORTED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  CLEARING_REQUESTED: 'CLEARING_REQUESTED',
  CLEARING_APPROVED: 'CLEARING_APPROVED',
  CLEARING_EXECUTED: 'CLEARING_EXECUTED',
  CLEARING_CANCELLED: 'CLEARING_CANCELLED',
  FOLDER_CREATED: 'ASSIGNMENT_FOLDER_CREATED',
  FOLDER_STATUS: 'ASSIGNMENT_FOLDER_STATUS',
  ITEM_CREATED: 'ASSIGNMENT_ITEM_CREATED',
  ITEM_UPDATED: 'ASSIGNMENT_ITEM_UPDATED',
  ITEM_DELETED: 'ASSIGNMENT_ITEM_DELETED',
  SUBMISSION_SET: 'SUBMISSION_STATUS_SET',
  RESOURCE_SHARED: 'RESOURCE_SHARED',
  RESOURCE_VERIFIED: 'RESOURCE_VERIFIED',
  RESOURCE_REMOVED: 'RESOURCE_REMOVED',
  EXPERIMENT_CREATED: 'EXPERIMENT_CREATED',
  EXPERIMENT_UPDATED: 'EXPERIMENT_UPDATED',
  EXPERIMENT_DELETED: 'EXPERIMENT_DELETED',
  EXPERIMENT_COMPLETION: 'EXPERIMENT_COMPLETION_SET',
  RECORD_UPLOADED: 'RECORD_FILE_UPLOADED',
  RECORD_VERIFIED: 'RECORD_FILE_VERIFIED',
  VISIT_CREATED: 'TEACHER_VISIT_CREATED',
  VISIT_RETURNED: 'TEACHER_VISIT_RETURNED',
  MEETING_CREATED: 'MEETING_REQUEST_CREATED',
  MEETING_CLOSED: 'MEETING_REQUEST_CLOSED',
  NOTIF_PREFS: 'NOTIFICATION_PREFS_UPDATED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  PRIVATE_FILE_OPENED: 'PRIVATE_FILE_OPENED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  PUSH_SUBSCRIBED: 'PUSH_SUBSCRIBED',
} as const;
