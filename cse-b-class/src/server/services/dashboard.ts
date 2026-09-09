import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { orm } from '@/server/db';
import {
  announcementReads,
  announcements,
  assignmentItems,
  assignmentFolders,
  assignmentResources,
  assignmentSubmissions,
  chatMessages,
  chatReports,
  dailyStatuses,
  experimentRecords,
  leaveRequests,
  odRequests,
  outOfClass,
  subjects,
  timetableSlots,
  users,
} from '@/drizzle/schema';
import { ROLES } from '@/lib/constants';
import type { AuthUser } from '@/server/auth';
import { todayStr } from '@/lib/dates';

/** §32 — clean student dashboard: only the 8 specified widgets. */
export async function studentDashboard(user: AuthUser) {
  const today = todayStr();
  const dayNum = new Date().getDay();

  const [profile] = await orm.select({ name: users.name, regNo: users.regNo, role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);

  // 2. today's timetable
  const slots = await orm
    .select({
      period: timetableSlots.period,
      isLab: timetableSlots.isLab,
      labName: timetableSlots.labName,
      labFloor: timetableSlots.labFloor,
      subjectName: subjects.name,
      subjectCode: subjects.code,
    })
    .from(timetableSlots)
    .leftJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
    .where(eq(timetableSlots.dayOfWeek, dayNum === 0 ? 1 : dayNum))
    .orderBy(timetableSlots.period);

  // 3. today's class status
  const [status] = await orm
    .select()
    .from(dailyStatuses)
    .where(and(eq(dailyStatuses.userId, user.id), eq(dailyStatuses.date, today)))
    .limit(1);

  // 4. latest announcements
  const ann = await orm
    .select({ id: announcements.id, title: announcements.title, message: announcements.message, createdAt: announcements.createdAt })
    .from(announcements)
    .where(isNull(announcements.deletedAt))
    .orderBy(desc(announcements.createdAt))
    .limit(3);
  const reads = ann.length
    ? await orm.select().from(announcementReads).where(and(eq(announcementReads.userId, user.id), inArray(announcementReads.announcementId, ann.map((a) => a.id))))
    : [];
  const readSet = new Set(reads.map((r) => r.announcementId));

  // 5. pending assignments (active folders, items without SUBMITTED)
  const activeFolders = await orm.select({ id: assignmentFolders.id }).from(assignmentFolders).where(eq(assignmentFolders.status, 'ACTIVE'));
  const items = activeFolders.length
    ? await orm
        .select({
          id: assignmentItems.id,
          title: assignmentItems.title,
          deadline: assignmentItems.deadline,
          subjectName: subjects.name,
          folderNumber: assignmentFolders.number,
        })
        .from(assignmentItems)
        .innerJoin(assignmentFolders, eq(assignmentItems.folderId, assignmentFolders.id))
        .innerJoin(subjects, eq(assignmentItems.subjectId, subjects.id))
        .where(and(inArray(assignmentItems.folderId, activeFolders.map((f) => f.id)), isNull(assignmentItems.deletedAt)))
        .orderBy(assignmentItems.deadline)
    : [];
  const mySubs = await orm.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.userId, user.id));
  const pending = items.filter((i) => mySubs.find((s) => s.itemId === i.id)?.status !== 'SUBMITTED').slice(0, 5);

  // 6. current out-of-class students (no reason — §11)
  const outNow = await orm
    .select({ id: outOfClass.id, name: users.name, destination: outOfClass.destination, outAt: outOfClass.outAt, expectedReturnAt: outOfClass.expectedReturnAt })
    .from(outOfClass)
    .innerJoin(users, eq(outOfClass.userId, users.id))
    .where(eq(outOfClass.status, 'OUT'))
    .limit(20);

  // 7. latest class chat activity
  const chat = await orm
    .select({ id: chatMessages.id, body: chatMessages.body, createdAt: chatMessages.createdAt, userName: users.name })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(and(eq(chatMessages.threadType, 'CLASS'), eq(chatMessages.threadId, 'class'), isNull(chatMessages.deletedAt)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(3);

  // 8. leave/od status
  const leaves = await orm
    .select({ id: leaveRequests.id, status: leaveRequests.status, fromDate: leaveRequests.fromDate, toDate: leaveRequests.toDate })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.userId, user.id), isNull(leaveRequests.deletedAt)))
    .orderBy(desc(leaveRequests.createdAt))
    .limit(2);
  const ods = await orm
    .select({ id: odRequests.id, status: odRequests.status, date: odRequests.date, programName: odRequests.programName })
    .from(odRequests)
    .where(and(eq(odRequests.userId, user.id), isNull(odRequests.deletedAt)))
    .orderBy(desc(odRequests.createdAt))
    .limit(2);

  // my active out-of-class record
  const [myOut] = await orm.select().from(outOfClass).where(and(eq(outOfClass.userId, user.id), eq(outOfClass.status, 'OUT'))).limit(1);

  return {
    profile: { name: profile?.name ?? user.name, regNo: profile?.regNo ?? user.regNo },
    timetable: slots,
    todayStatus: status ? { status: status.status, halfDayPart: status.halfDayPart } : null,
    announcements: ann.map((a) => ({ ...a, read: readSet.has(a.id) })),
    pendingAssignments: pending,
    outNow,
    chatActivity: chat,
    leaveStatus: leaves,
    odStatus: ods,
    myOutOfClass: myOut ? { id: myOut.id, destination: myOut.destination, outAt: myOut.outAt, expectedReturnAt: myOut.expectedReturnAt } : null,
  };
}

/** Advisor/Admin console overview. */
export async function consoleOverview() {
  const today = todayStr();
  const [[students], [reps], [pendingLeaves], [pendingODs], [outNow], [activeFolders], [pendingResources], [openReports], [pendingRecords]] = await Promise.all([
    orm.select({ n: sql<number>`count(*)` }).from(users).where(and(inArray(users.role, [ROLES.STUDENT, ROLES.REPRESENTATIVE]), isNull(users.deletedAt), eq(users.isActive, true))),
    orm.select({ n: sql<number>`count(*)` }).from(users).where(and(eq(users.role, ROLES.REPRESENTATIVE), isNull(users.deletedAt), eq(users.isActive, true))),
    orm.select({ n: sql<number>`count(*)` }).from(sql`leave_requests`).where(sql`status = 'PENDING'`),
    orm.select({ n: sql<number>`count(*)` }).from(sql`od_requests`).where(sql`status = 'PENDING'`),
    orm.select({ n: sql<number>`count(*)` }).from(outOfClass).where(eq(outOfClass.status, 'OUT')),
    orm.select({ n: sql<number>`count(*)` }).from(assignmentFolders).where(eq(assignmentFolders.status, 'ACTIVE')),
    orm.select({ n: sql<number>`count(*)` }).from(sql`assignment_resources`).where(sql`status = 'PENDING' AND deleted_at IS NULL`),
    orm.select({ n: sql<number>`count(*)` }).from(sql`chat_reports`).where(sql`status = 'OPEN'`),
    orm.select({ n: sql<number>`count(*)` }).from(sql`experiment_records`).where(sql`status = 'PENDING'`),
  ]);
  const [statusMarks] = await orm.select({ n: sql<number>`count(*)` }).from(dailyStatuses).where(eq(dailyStatuses.date, today));
  return {
    students: Number(students?.n ?? 0),
    representatives: Number(reps?.n ?? 0),
    pendingLeaves: Number(pendingLeaves?.n ?? 0),
    pendingODs: Number(pendingODs?.n ?? 0),
    outNow: Number(outNow?.n ?? 0),
    activeFolders: Number(activeFolders?.n ?? 0),
    pendingResources: Number(pendingResources?.n ?? 0),
    openReports: Number(openReports?.n ?? 0),
    pendingRecords: Number(pendingRecords?.n ?? 0),
    todayStatusMarks: Number(statusMarks?.n ?? 0),
  };
}
