import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'node:crypto';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID());
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });
const now = () => ts('created_at').$defaultFn(() => new Date()).notNull();
const bool = (name: string) => integer(name, { mode: 'boolean' }).notNull().default(false);

// ---------------------------------------------------------------- users/auth
export const users = sqliteTable(
  'users',
  {
    id: id(),
    username: text('username').notNull(), // students: register number; staff: staff id
    regNo: text('reg_no'),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['STUDENT', 'REPRESENTATIVE', 'ADVISOR', 'ADMIN'] }).notNull(),
    name: text('name').notNull(),
    email: text('email'),
    dob: text('dob'), // yyyy-mm-dd (private)
    bloodGroup: text('blood_group'), // private
    address: text('address'), // private
    mobile: text('mobile'),
    mustChangePassword: bool('must_change_password').default(false),
    isActive: bool('is_active').default(true),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('users_username_uq').on(t.username), uniqueIndex('users_regno_uq').on(t.regNo), index('users_role_idx').on(t.role)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    expiresAt: ts('expires_at').notNull(),
    createdAt: now(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const passwordResets = sqliteTable(
  'password_resets',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    tempPassword: text('temp_password').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
  },
  (t) => [uniqueIndex('pwreset_token_uq').on(t.tokenHash)],
);

// ---------------------------------------------------------------- class setup
export const subjects = sqliteTable(
  'subjects',
  {
    id: id(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    facultyName: text('faculty_name').notNull(),
    facultyFloor: text('faculty_floor'),
    facultyRoom: text('faculty_room'),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('subjects_code_uq').on(t.code)],
);

export const timetableSlots = sqliteTable(
  'timetable_slots',
  {
    id: id(),
    dayOfWeek: integer('day_of_week').notNull(), // 1=Mon .. 6=Sat
    period: integer('period').notNull(), // 1..8
    subjectId: text('subject_id').references(() => subjects.id),
    isLab: bool('is_lab').default(false),
    labName: text('lab_name'),
    labFloor: text('lab_floor'),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('tt_day_period_uq').on(t.dayOfWeek, t.period)],
);

// ---------------------------------------------------------------- status
export const dailyStatuses = sqliteTable(
  'daily_status',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    date: text('date').notNull(), // yyyy-mm-dd
    status: text('status', { enum: ['PRESENT', 'NOT_COMING', 'LATE', 'HALF_DAY'] }).notNull(),
    reason: text('reason'),
    halfDayPart: text('half_day_part'),
    halfDayTime: text('half_day_time'),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('daily_user_date_uq').on(t.userId, t.date), index('daily_date_idx').on(t.date)],
);

export const outOfClass = sqliteTable(
  'out_of_class_records',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    destination: text('destination').notNull(),
    reason: text('reason').notNull(), // Advisor + Representatives only
    outAt: ts('out_at').$defaultFn(() => new Date()).notNull(),
    expectedReturnAt: ts('expected_return_at').notNull(),
    backAt: ts('back_at'),
    status: text('status', { enum: ['OUT', 'BACK', 'CLEARED'] }).notNull().default('OUT'),
    clearedById: text('cleared_by_id'),
    clearedAt: ts('cleared_at'),
  },
  (t) => [index('ooc_status_idx').on(t.status), index('ooc_user_idx').on(t.userId)],
);

// ---------------------------------------------------------------- leave / od
export const leaveRequests = sqliteTable(
  'leave_requests',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    reason: text('reason').notNull(), // private: owner + Advisor
    contact: text('contact'),
    status: text('status', {
      enum: ['PENDING', 'LETTER_PENDING', 'LETTER_POSTED', 'REP_CONFIRMED', 'REJECTED', 'WITHDRAWN'],
    })
      .notNull()
      .default('PENDING'),
    decidedById: text('decided_by_id'),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note'),
    withdrawalRequested: bool('withdrawal_requested').default(false),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('leave_user_idx').on(t.userId), index('leave_status_idx').on(t.status)],
);

export const leaveDocuments = sqliteTable('leave_documents', {
  id: id(),
  leaveId: text('leave_id').notNull().references(() => leaveRequests.id),
  fileId: text('file_id').notNull().unique(),
  uploadedById: text('uploaded_by_id').notNull(),
  uploadedAt: now(),
  confirmedById: text('confirmed_by_id'),
  confirmedAt: ts('confirmed_at'),
});

export const odRequests = sqliteTable(
  'od_requests',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    programName: text('program_name').notNull(),
    place: text('place').notNull(),
    date: text('date').notNull(),
    fromTime: text('from_time').notNull(), // HH:mm
    toTime: text('to_time').notNull(),
    reason: text('reason').notNull(), // private: owner + Advisor
    status: text('status', {
      enum: ['PENDING', 'LETTER_REQUIRED', 'LETTER_POSTED', 'REP_CONFIRMED', 'REJECTED', 'WITHDRAWN'],
    })
      .notNull()
      .default('PENDING'),
    decidedById: text('decided_by_id'),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note'),
    withdrawalRequested: bool('withdrawal_requested').default(false),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('od_user_idx').on(t.userId), index('od_status_idx').on(t.status)],
);

export const odDocuments = sqliteTable('od_documents', {
  id: id(),
  odId: text('od_id').notNull().references(() => odRequests.id),
  fileId: text('file_id').notNull().unique(),
  uploadedById: text('uploaded_by_id').notNull(),
  uploadedAt: now(),
  confirmedById: text('confirmed_by_id'),
  confirmedAt: ts('confirmed_at'),
});

// ---------------------------------------------------------------- announcements
export const announcements = sqliteTable(
  'announcements',
  {
    id: id(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    fileId: text('file_id'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
    deletedById: text('deleted_by_id'),
  },
  (t) => [index('announcements_created_idx').on(t.createdAt)],
);

export const announcementReads = sqliteTable(
  'announcement_reads',
  {
    id: id(),
    announcementId: text('announcement_id').notNull().references(() => announcements.id),
    userId: text('user_id').notNull().references(() => users.id),
    readAt: now(),
  },
  (t) => [uniqueIndex('annread_uq').on(t.announcementId, t.userId)],
);

// ---------------------------------------------------------------- chat (per-module threads)
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: id(),
    threadType: text('thread_type', { enum: ['CLASS', 'ASSIGNMENT', 'EXPERIMENT'] }).notNull(),
    threadId: text('thread_id').notNull(), // "class" | assignment item id | experiment id
    userId: text('user_id').notNull().references(() => users.id),
    body: text('body'),
    fileId: text('file_id'),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
    deletedById: text('deleted_by_id'),
    deleteNote: text('delete_note'),
  },
  (t) => [index('chat_thread_idx').on(t.threadType, t.threadId, t.createdAt)],
);

export const chatReports = sqliteTable(
  'chat_reports',
  {
    id: id(),
    messageId: text('message_id').notNull().references(() => chatMessages.id),
    reportedById: text('reported_by_id').notNull(),
    category: text('category').notNull(), // ABUSE | SPAM | INCORRECT | PRIVATE_INFO | OTHER
    description: text('description'),
    status: text('status', { enum: ['OPEN', 'RESOLVED', 'DISMISSED'] }).notNull().default('OPEN'),
    resolvedById: text('resolved_by_id'),
    resolvedAt: ts('resolved_at'),
    resolutionNote: text('resolution_note'),
    createdAt: now(),
  },
  (t) => [index('reports_status_idx').on(t.status)],
);

// ---------------------------------------------------------------- chat clearing (multi-party approval)
export const clearingRequests = sqliteTable(
  'clearing_requests',
  {
    id: id(),
    scope: text('scope', { enum: ['CLASS_CHAT_MESSAGE', 'CLASS_CHAT_FILE'] }).notNull(),
    targetId: text('target_id').notNull(),
    targetPreview: text('target_preview').notNull(),
    reason: text('reason').notNull(),
    requestedById: text('requested_by_id').notNull(),
    status: text('status', { enum: ['PENDING', 'EXECUTED', 'CANCELLED'] }).notNull().default('PENDING'),
    executedAt: ts('executed_at'),
    createdAt: now(),
  },
  (t) => [index('clearing_status_idx').on(t.status)],
);

export const clearingApprovals = sqliteTable(
  'clearing_approvals',
  {
    id: id(),
    requestId: text('request_id').notNull().references(() => clearingRequests.id),
    approverId: text('approver_id').notNull(),
    approverRole: text('approver_role').notNull(),
    decision: text('decision').notNull().default('APPROVED'),
    note: text('note'),
    createdAt: now(),
  },
  (t) => [uniqueIndex('clearing_approval_uq').on(t.requestId, t.approverId)],
);

// ---------------------------------------------------------------- assignments
export const assignmentFolders = sqliteTable('assignment_folders', {
  id: id(),
  number: integer('number').notNull().unique(),
  status: text('status', { enum: ['ACTIVE', 'COMPLETED'] }).notNull().default('ACTIVE'),
  completedAt: ts('completed_at'),
  createdById: text('created_by_id').notNull(),
  createdAt: now(),
  updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
});

export const assignmentItems = sqliteTable(
  'assignment_items',
  {
    id: id(),
    folderId: text('folder_id').notNull().references(() => assignmentFolders.id),
    subjectId: text('subject_id').notNull().references(() => subjects.id),
    title: text('title').notNull(),
    instructions: text('instructions'),
    deadline: ts('deadline'),
    requiredFilesNote: text('required_files_note'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('assign_folder_subject_uq').on(t.folderId, t.subjectId)],
);

export const assignmentSubmissions = sqliteTable(
  'assignment_submissions',
  {
    id: id(),
    itemId: text('item_id').notNull().references(() => assignmentItems.id),
    userId: text('user_id').notNull().references(() => users.id),
    status: text('status', { enum: ['SUBMITTED', 'NOT_SUBMITTED'] }).notNull(),
    markedById: text('marked_by_id').notNull(),
    markedAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('sub_item_user_uq').on(t.itemId, t.userId), index('sub_user_idx').on(t.userId)],
);

export const assignmentResources = sqliteTable(
  'assignment_resources',
  {
    id: id(),
    itemId: text('item_id').notNull().references(() => assignmentItems.id),
    uploaderId: text('uploader_id').notNull(),
    kind: text('kind', { enum: ['FILE', 'LINK'] }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    fileId: text('file_id').unique(),
    status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).notNull().default('PENDING'),
    verifiedById: text('verified_by_id'),
    verifiedAt: ts('verified_at'),
    note: text('note'),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('ares_item_status_idx').on(t.itemId, t.status)],
);

// ---------------------------------------------------------------- record & observation
export const experiments = sqliteTable(
  'experiments',
  {
    id: id(),
    subjectId: text('subject_id').notNull().references(() => subjects.id),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    details: text('details'),
    instructions: text('instructions'),
    requiredFilesNote: text('required_files_note'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('exp_subject_number_uq').on(t.subjectId, t.number)],
);

export const experimentCompletions = sqliteTable(
  'experiment_completions',
  {
    id: id(),
    experimentId: text('experiment_id').notNull().references(() => experiments.id),
    userId: text('user_id').notNull().references(() => users.id),
    status: text('status', { enum: ['COMPLETED', 'NOT_COMPLETED'] }).notNull(),
    updatedById: text('updated_by_id').notNull(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('expcomp_uq').on(t.experimentId, t.userId), index('expcomp_user_idx').on(t.userId)],
);

export const experimentRecords = sqliteTable(
  'experiment_records',
  {
    id: id(),
    experimentId: text('experiment_id').notNull().references(() => experiments.id),
    userId: text('user_id').notNull().references(() => users.id),
    fileId: text('file_id').notNull().unique(),
    note: text('note'),
    status: text('status', { enum: ['PENDING', 'VERIFIED', 'REJECTED'] }).notNull().default('PENDING'),
    verifiedById: text('verified_by_id'),
    verifiedAt: ts('verified_at'),
    verificationNote: text('verification_note'),
    uploadedAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex('exprec_uq').on(t.experimentId, t.userId)],
);

export const experimentResources = sqliteTable(
  'experiment_resources',
  {
    id: id(),
    experimentId: text('experiment_id').notNull().references(() => experiments.id),
    uploaderId: text('uploader_id').notNull(),
    kind: text('kind', { enum: ['FILE', 'LINK'] }).notNull(),
    title: text('title').notNull(),
    url: text('url'),
    fileId: text('file_id').unique(),
    status: text('status', { enum: ['PENDING', 'APPROVED', 'REJECTED'] }).notNull().default('PENDING'),
    verifiedById: text('verified_by_id'),
    verifiedAt: ts('verified_at'),
    note: text('note'),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('eres_exp_status_idx').on(t.experimentId, t.status)],
);

// ---------------------------------------------------------------- visits & meetings
export const teacherVisits = sqliteTable(
  'teacher_visit_records',
  {
    id: id(),
    studentId: text('student_id').notNull().references(() => users.id),
    teacherName: text('teacher_name').notNull(),
    location: text('location').notNull(),
    reason: text('reason').notNull(),
    outAt: ts('out_at').notNull(),
    expectedReturnAt: ts('expected_return_at').notNull(),
    returnStatus: text('return_status', { enum: ['OUT', 'RETURNED'] }).notNull().default('OUT'),
    returnedAt: ts('returned_at'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
    updatedAt: ts('updated_at').$defaultFn(() => new Date()).notNull(),
  },
  (t) => [index('visits_student_idx').on(t.studentId)],
);

export const meetingRequests = sqliteTable(
  'advisor_meeting_requests',
  {
    id: id(),
    studentId: text('student_id').notNull().references(() => users.id),
    message: text('message').notNull(),
    date: text('date'),
    time: text('time'),
    location: text('location'),
    reason: text('reason'),
    status: text('status', { enum: ['OPEN', 'CLOSED'] }).notNull().default('OPEN'),
    createdById: text('created_by_id').notNull(),
    createdAt: now(),
    closedAt: ts('closed_at'),
  },
  (t) => [index('meetings_student_idx').on(t.studentId)],
);

// ---------------------------------------------------------------- notifications & ops
export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    category: text('category').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    readAt: ts('read_at'),
    createdAt: now(),
  },
  (t) => [index('notif_user_idx').on(t.userId, t.createdAt)],
);

export const notificationPreferences = sqliteTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  prefs: text('prefs').notNull().default('{}'), // JSON: category -> enabled
});

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: id(),
    actorId: text('actor_id'),
    actorRole: text('actor_role'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: text('metadata'), // JSON string
    ip: text('ip'),
    createdAt: now(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_action_idx').on(t.action)],
);

export const fileObjects = sqliteTable(
  'file_objects',
  {
    id: id(),
    ownerId: text('owner_id').notNull().references(() => users.id),
    module: text('module').notNull(), // LEAVE | OD | ASSIGNMENT | EXPERIMENT | CHAT | ANNOUNCEMENT | IMPORT
    entityId: text('entity_id'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    sha256: text('sha256'),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('files_module_idx').on(t.module, t.entityId)],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: now(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('push_user_idx').on(t.userId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
