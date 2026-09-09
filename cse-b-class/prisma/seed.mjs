/**
 * CSE B Class — demo seed (idempotent: clears demo tables first).
 *
 * Demo accounts (documented in README):
 *   Admin:        admin      / Admin@12345
 *   Advisor:      advisor    / Advisor@123
 *   Students:     CB22001 … CB22020, password = DOB as DDMMYYYY (e.g. CB22001 → 15082005)
 *   Reps:         CB22001 (Aarav Sharma), CB22002 (Diya Patel)
 *
 * NOTE: seeded accounts skip the forced password change for demo convenience.
 * The Excel import flow (spec §8/§41) always forces a password change on first login.
 */
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

config();

const url = process.env.DATABASE_URL || 'file:./dev.db';
const db = createClient({ url: url.startsWith('file:') ? url.replace('./', process.cwd() + '/') : url });

const uid = () => randomUUID();
const hash = (p) => bcrypt.hashSync(p, 10);

await db.executeMultiple(`
  DELETE FROM chat_reports; DELETE FROM clearing_approvals; DELETE FROM clearing_requests;
  DELETE FROM chat_messages; DELETE FROM announcement_reads; DELETE FROM announcements;
  DELETE FROM assignment_resources; DELETE FROM assignment_submissions; DELETE FROM assignment_items; DELETE FROM assignment_folders;
  DELETE FROM experiment_resources; DELETE FROM experiment_records; DELETE FROM experiment_completions; DELETE FROM experiments;
  DELETE FROM teacher_visit_records; DELETE FROM advisor_meeting_requests;
  DELETE FROM leave_documents; DELETE FROM leave_requests; DELETE FROM od_documents; DELETE FROM od_requests;
  DELETE FROM out_of_class_records; DELETE FROM daily_status; DELETE FROM timetable_slots; DELETE FROM subjects;
  DELETE FROM notifications; DELETE FROM notification_preferences; DELETE FROM audit_logs;
  DELETE FROM push_subscriptions; DELETE FROM password_resets; DELETE FROM sessions; DELETE FROM users; DELETE FROM settings;
`);

const users = [];
function addUser(u) {
  const id = uid();
  users.push({ ...u, id });
  return id;
}

async function insertUser(u) {
  await db.execute({
    sql: `INSERT INTO users (id, username, reg_no, password_hash, role, name, dob, blood_group, address, mobile, must_change_password, is_active, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      u.id, u.username, u.regNo ?? null, hash(u.password), u.role, u.name,
      u.dob ?? null, u.bloodGroup ?? null, u.address ?? null, u.mobile ?? null,
      0, 1, Date.now(), Date.now(),
    ],
  });
}

// ---- staff
const adminId = addUser({ username: 'admin', role: 'ADMIN', name: 'App Administrator', password: 'Admin@12345' });
const advisorId = addUser({ username: 'advisor', role: 'ADVISOR', name: 'Prof. Meera Krishnan', password: 'Advisor@123' });
await insertUser(users[0]);
await insertUser(users[1]);

// ---- students CB22001..CB22020
const firstNames = ['Aarav', 'Diya', 'Rohan', 'Sneha', 'Vikram', 'Ananya', 'Karthik', 'Priya', 'Arjun', 'Kavya', 'Sanjay', 'Meenakshi', 'Aditya', 'Divya', 'Nikhil', 'Ishita', 'Harish', 'Lakshmi', 'Varun', 'Nithya'];
const lastNames = ['Sharma', 'Patel', 'Iyer', 'Reddy', 'Kumar', 'Rao', 'Menon', 'Nair', 'Verma', 'Ganesh'];
const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-'];

let rep1 = '', rep2 = '';
for (let i = 0; i < 20; i++) {
  const regNo = `CB220${String(i + 1).padStart(2, '0')}`;
  const day = String(((i * 3) % 27) + 1).padStart(2, '0');
  const month = String(((i * 5) % 12) + 1).padStart(2, '0');
  const dob = `2005-${month}-${day}`;
  const id = addUser({
    username: regNo,
    regNo,
    role: 'STUDENT',
    name: `${firstNames[i]} ${lastNames[i % lastNames.length]}`,
    dob,
    password: `${day}${month}2005`.slice(0, 8),
    bloodGroup: bloodGroups[i % bloodGroups.length],
    mobile: `98${String(760000000 + i * 111111).slice(0, 8)}`,
    address: `${12 + i} College Road, Coimbatore`,
  });
  await insertUser(users[users.length - 1]);
  if (i === 0) rep1 = id;
  if (i === 1) rep2 = id;
}
for (const [id, name] of [[rep1, ''], [rep2, '']]) {
  await db.execute({ sql: `UPDATE users SET role='REPRESENTATIVE' WHERE id=?`, args: [id] });
  void name;
}

// ---- subjects
const subjects = [
  ['Data Structures', 'CS201', 'Dr. Ramesh Babu', '2', 'C201'],
  ['Java Programming', 'CS202', 'Prof. Lakshmi Narayanan', '1', 'C105'],
  ['Mathematics III', 'MA201', 'Dr. Sunita Rao', '3', 'M301'],
  ['Digital Electronics', 'EC203', 'Prof. Ganesh Moorthy', '2', 'E204'],
  ['Operating Systems', 'CS204', 'Dr. Kavitha S', '1', 'C110'],
  ['Soft Skills', 'HS201', 'Ms. Ramya Krishnan', '0', 'S001'],
];
const subjectIds = {};
for (const [name, code, faculty, floor, room] of subjects) {
  const id = uid();
  subjectIds[code] = id;
  await db.execute({
    sql: `INSERT INTO subjects (id, name, code, faculty_name, faculty_floor, faculty_room, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    args: [id, name, code, faculty, floor, room, Date.now(), Date.now()],
  });
}

// ---- timetable Mon-Fri, 8 periods (period 8 free)
const plan = {
  1: ['CS201', 'CS202', 'MA201', 'CS204', 'CS201', 'HS201', null, null],
  2: ['CS202', 'CS201', 'EC203', 'MA201', 'CS204', 'CS202', null, null],
  3: ['MA201', 'CS204', 'CS201', 'CS202', 'EC203', 'MA201', null, null],
  4: ['CS204', 'EC203', 'CS202', 'CS201', 'MA201', 'CS204', null, null],
  5: ['CS201', 'MA201', 'CS204', 'EC203', 'CS202', 'HS201', null, null],
};
for (const [day, periods] of Object.entries(plan)) {
  for (let p = 0; p < 8; p++) {
    const code = periods[p];
    // Wednesday afternoon = Data Structures lab
    const isLab = Number(day) === 3 && (p === 4 || p === 5);
    await db.execute({
      sql: `INSERT INTO timetable_slots (id, day_of_week, period, subject_id, is_lab, lab_name, lab_floor, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
      args: [uid(), Number(day), p + 1, code ? subjectIds[code] : null, isLab ? 1 : 0, isLab ? 'Programming Lab 2' : null, isLab ? '1st Floor' : null, Date.now()],
    });
  }
}

// ---- Assignment 1 folder with items for 4 subjects
const folder1 = uid();
await db.execute({ sql: `INSERT INTO assignment_folders (id, number, status, created_by_id, created_at, updated_at) VALUES (?,?, 'ACTIVE', ?, ?, ?)`, args: [folder1, 1, advisorId, Date.now(), Date.now()] });
const folder2 = uid();
await db.execute({ sql: `INSERT INTO assignment_folders (id, number, status, created_by_id, created_at, updated_at) VALUES (?,?, 'ACTIVE', ?, ?, ?)`, args: [folder2, 2, advisorId, Date.now(), Date.now()] });

const items = [
  [folder1, 'CS201', 'Assignment 1 — Arrays & Linked Lists', 'Solve problems 1–15 from the unit. Handwrite on ruled sheets.'],
  [folder1, 'CS202', 'Assignment 1 — Classes & Objects', 'Write 8 programs. Submit as handwritten record.'],
  [folder1, 'MA201', 'Assignment 1 — Probability', 'Problems from Chapter 4, pages 112–118.'],
  [folder1, 'EC203', 'Assignment 1 — Boolean Algebra', 'K-map simplifications, 10 problems.'],
  [folder2, 'CS201', 'Assignment 2 — Trees & Graphs', 'Traversal problems 1–12.'],
  [folder2, 'CS202', 'Assignment 2 — Inheritance & Interfaces', 'Write 6 programs with output.'],
];
for (const [folderId, code, title, instructions] of items) {
  await db.execute({
    sql: `INSERT INTO assignment_items (id, folder_id, subject_id, title, instructions, deadline, created_by_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [uid(), folderId, subjectIds[code], title, instructions, Date.now() + 5 * 86400000, advisorId, Date.now(), Date.now()],
  });
}

// ---- Experiments: Java (3) + DS (3)
const experiments = [
  ['CS202', 1, 'Stack implementation using arrays', 'Implement push, pop, peek with overflow handling.'],
  ['CS202', 2, 'Employee payroll using inheritance', 'Base class Employee; Manager & Engineer subclasses.'],
  ['CS202', 3, 'File handling — student marks', 'Read/write CSV of marks with exception handling.'],
  ['CS201', 1, 'Linear & binary search', 'Compare comparisons on sorted input of 1000 elements.'],
  ['CS201', 2, 'Singly linked list operations', 'Insert, delete, reverse; observe pointer diagrams in record.'],
  ['CS201', 3, 'Expression evaluation using stacks', 'Infix to postfix + evaluation.'],
];
const expIds = {};
for (const [code, number, name, details] of experiments) {
  const id = uid();
  expIds[`${code}-${number}`] = id;
  await db.execute({
    sql: `INSERT INTO experiments (id, subject_id, number, name, details, instructions, created_by_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [id, subjectIds[code], number, name, details, 'Write aim, algorithm, program, output and result in your record.', advisorId, Date.now(), Date.now()],
  });
}

// ---- announcements
for (const [title, message] of [
  ['Model Test 1 timetable released', 'Model Test 1 begins next Monday. DS on Monday, Java on Wednesday. Bring your own graph sheets.'],
  ['Record submission — Java', 'Experiments 1 and 2 records must be verified before Friday 4 PM. Upload your record files in Record & Observation.'],
]) {
  await db.execute({
    sql: `INSERT INTO announcements (id, title, message, created_by_id, created_at) VALUES (?,?,?,?,?)`,
    args: [uid(), title, message, advisorId, Date.now()],
  });
}

// ---- a little class chat
for (const [name, body] of [
  [0, 'Good morning everyone. Today period 5 is free — DS faculty is on leave.'],
  [3, 'Thanks! Are we submitting the Maths record today?'],
  [4, 'Yes, before 4 PM to the staff room.'],
]) {
  await db.execute({
    sql: `INSERT INTO chat_messages (id, thread_type, thread_id, user_id, body, created_at) VALUES (?, 'CLASS', 'class', ?, ?, ?)`,
    args: [uid(), users.find((u) => u.username === `CB220${String(name + 1).padStart(2, '0')}`)?.id ?? advisorId, body, Date.now() - (3 - name) * 3600000],
  });
}

// ---- sample statuses for today (half the class present)
const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
for (let i = 2; i < 10; i++) {
  const u = users.find((x) => x.regNo === `CB220${String(i + 1).padStart(2, '0')}`);
  if (!u) continue;
  await db.execute({
    sql: `INSERT INTO daily_status (id, user_id, date, status, reason, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
    args: [uid(), u.id, dateStr, i % 4 === 0 ? 'LATE' : 'PRESENT', i % 4 === 0 ? 'Bus delayed' : null, Date.now(), Date.now()],
  });
}

// ---- notification preference rows (all default-on)
for (const u of users) {
  await db.execute({ sql: `INSERT INTO notification_preferences (user_id, prefs) VALUES (?, '{}')`, args: [u.id] });
}

// ---- audit
await db.execute({
  sql: `INSERT INTO audit_logs (id, actor_id, actor_role, actor_name, action, metadata, created_at) VALUES (?,?,?,?,?,?,?)`,
  args: [uid(), adminId, 'ADMIN', 'App Administrator', 'SEED_COMPLETED', JSON.stringify({ users: users.length }), Date.now()],
});
void adminId;

console.log(`✔ Seeded: ${users.length} accounts (1 admin, 1 advisor, 2 reps, 18 students), 6 subjects, timetable, 6 assignment items, 6 experiments, announcements, chat.`);
console.log('  Admin: admin / Admin@12345 · Advisor: advisor / Advisor@123 · Students: CB22001 / 15082005 (rep CB22001)');
