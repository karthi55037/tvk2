# CSE B Class

A production-grade class-management app for a single college class (up to 200 students) — web-first PWA that installs on Android, iOS and desktop, with offline support, push notifications and real-time updates.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 14** (App Router, TypeScript) | One codebase for web + installable PWA; server-side API routes keep all authorization server-side |
| UI | Tailwind CSS + lucide-react | Responsive mobile-first UI, bottom navigation on phones |
| Database | **SQLite via libsql** (`@libsql/client`) + **Drizzle ORM** | Zero-ops centralized DB; swap `DATABASE_URL` to a Turso URL for hosted/replicated SQLite without code changes |
| Auth | JWT (HttpOnly, SameSite=Lax cookies) + bcrypt password hashing | No session store needed; cookies are not readable by JS |
| Files | Filesystem object storage (`STORAGE_DIR`), never DB rows | Authorized streaming URLs with server-side ACL checks |
| Push | Web Push (VAPID) via service worker | Works when the app is closed |
| Realtime | Server-Sent Events | Lightweight per-user event fan-out |
| Tests | Vitest (36 tests across 5 suites) | Service-level integration tests on an isolated per-process DB |

## Quick start

```bash
npm install
npm run setup        # writes .env (secrets + VAPID keys) if missing
npm run db:migrate   # apply drizzle migrations (idempotent)
npm run db:seed      # optional: demo class (admin, advisor, CB22001–CB22020)
npm run build && npm start   # production (runs migrations first)
# dev: npm run dev
```

- Web app: `http://localhost:3000`
- Seeded accounts: `admin / Admin@12345`, `advisor / Advisor@123`, students `CB22001…` (initial password = DOB as `DDMMYYYY`, forced change at first login; seeded demo users have `must_change_password=0`)

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` or `libsql://….turso.io` URL |
| `JWT_SECRET` | Signing key for auth cookies |
| `APP_TZ` | IANA timezone for day/period calculations (default `Asia/Kolkata`) |
| `STORAGE_DIR` | Directory for uploaded files (outside web root) |
| `MAX_UPLOAD_MB` | Upload size cap (default 10) |
| `APP_ORIGIN` | Allowed origin for CORS/CSRF checks |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push keys (`npm run setup` generates) |

### Scripts

`dev` · `build` · `start` (migrate + serve) · `test` (vitest) · `db:generate` (drizzle-kit) · `db:migrate` · `db:seed` · `setup`

## Roles

- **Student** — the class member. Views timetable/status/assignments/chat/record; edits own contact fields.
- **Representative** (max **4**) — added/removed by Advisor, Admin, or another Rep (never self). Verifies assignment submissions & shared resources, confirms leave/OD letters, logs teacher visits, reports chat abuse, co-approves history clearing.
- **Class Advisor** (max **1**) — appointed/removed by Representatives or Admins (explicit remove-then-appoint; never a silent replace; removal demotes to Admin). Sole approver of leave/OD; sees reasons; can edit any student's record; moderates assignment chats; deletes class-chat messages only via the clearing flow.
- **App Admin** (≥1 always) — allocates/removes other admins, appoints advisor, emergency takedown, imports students, views audit log & console.

Any **one** Representative suffices wherever a workflow calls for representative confirmation.

## Module map (deliberately independent)

Main class chat · Assignment chats (per item) · Experiment chats · Assignments · Record & Observation · Leave · OD · Teacher visits · Daily status · Out-of-class status — each has its own data tables, permission checks, navigation entry and lifecycle. Clearing/deleting one never touches another; the class chat has a separate multi-party clearing flow while other modules keep their history.

## Privacy model (enforced server-side)

| Data | Who sees it |
| --- | --- |
| Student directory (another student) | name, register no, mobile only (+ blood group for Reps/Advisor) — never DOB/address |
| Leave / OD **reason** | owner + Advisor only. Reps see requests from the letter stage onward **without** the reason; Admins see post-decision status only, never reasons; PENDING requests are Advisor-only |
| Out-of-class reason | Advisor + Reps only (other students see the status without the reason) |
| Teacher-visit records | Advisor, Reps, and the involved student only |
| Notifications | respect the same privacy cuts (recipients computed server-side) |

## Key workflows

- **Leave / OD** — student submits (idempotent; double-taps and retries cannot create duplicates) → **only the Advisor** approves/rejects → physical letter is signed and uploaded to the request placeholder (magic-byte file-type verification) → **one Rep confirms** → `REP_CONFIRMED`. OD letters are not required at request time. Withdrawal is silent only while PENDING; after approval it becomes a *withdrawal request* the Advisor resolves — approval is never silently cancelled. Statuses: `PENDING → APPROVED/LETTER_PENDING → LETTER_POSTED → REP_CONFIRMED`, plus `REJECTED` / `WITHDRAWN`.
- **Assignments** — "Assignment N" folders (auto-numbered) each hold that number's item for every subject. Students never upload; they mark themselves Submitted/Not Submitted. Reps verify/correct anyone. Boards show live counts (e.g. 175/200). Resources: student share → Rep verifies → visible to all; staff shares are auto-approved. Completed folders are archived under *Completed Assignments* and never auto-deleted.
- **Record & Observation** — organized Subject → Experiments (auto-numbered per subject); one record per student per experiment; re-upload resets verification; any single Rep/Advisor/Admin verifies; foreign record files are masked from students.
- **Chat** — main class chat is text-only (emojis/stickers rejected server-side); files allowed; sender names come from profiles. Reps (only) report messages; Advisor moderation of the class chat and any history clearing must pass the **clearing approval flow**; Admins have an emergency takedown (see Security design). Assignment/experiment chats are moderated directly by Advisor/Admin.
- **Clearing approval** — class-chat history is cleared only with Advisor **+ all active Reps** **+ at least one Admin** (when there are no reps: Advisor + Admin). Fully audited; auto-executes on the last approval.
- **Excel import** — exact headers (Register Number, Name, Date of Birth, Blood Group, Address, Mobile Number); validation (real DOB, not future; Indian mobile format; blood-group whitelist; in-file duplicate register numbers); dry-run preview with per-row errors, then commit with a `{created, updated, skipped, errors[]}` report. New students get initial password = DOB (`DDMMYYYY`) and must change it at first login. Existing students are updated only on non-empty changed fields; passwords/roles untouched. Passwords are stored as bcrypt hashes — never plaintext.
- **Timetable** — 8 periods/day (P8 empty by default); lab periods carry lab name + floor; subjects hold faculty name/floor/cabin only. Managed by Advisor/Reps.

## Security design

- **Server-side authorization everywhere** — every API route resolves the caller from the signed cookie; client-sent roles/permissions are never trusted. An RBAC matrix (`src/server/rbac.ts`) centralizes capability checks.
- **Audit log** — every sensitive action records actor, action, target, timestamp and metadata (logins, decisions, confirmations, role changes, profile edits, moderations, clearing, imports…). Admin console exposes it.
- **File storage** — uploads land in `STORAGE_DIR` with random names; type checked by magic bytes (not extension/MIME), size capped; downloads stream through an ACL check (owner / module / entity / role) — no public URLs.
- **Rate limits** — login attempts (per-IP), uploads (per-user); identical error for unknown user and wrong password (no user enumeration).
- **Idempotency / double-submit** — unique constraints + state-machine guards make leave/OD submissions and other transitions retry-safe; the client disables buttons while a request is in flight and shows connection status (offline banner + SSE reconnect).
- **Emergency moderation (documented, per spec allowance)** — Admin-only *takedown* of a class-chat message for serious violations; audited, single-message, and narrower than the full clearing flow which still requires multi-party approval for Advisor-initiated deletion/history clearing.
- **Error handling** — friendly user-facing messages; stack traces never reach the client; all failures are logged server-side.
- **PWA** — the service worker never caches app HTML or API responses; offline navigation falls back to a static offline page.

## Testing

```bash
npm test        # vitest — fresh isolated DB per process
```

36 tests in 5 suites cover: directory/leave/OD/out-of-class/visit privacy cuts, the full leave & OD letter chains, withdrawal semantics, rep caps & role authority (incl. advisor remove-before-appoint and last-admin protection), assignment folders/submissions/resources, Record & Observation, Excel import validation & commit report, chat rules (emoji ban, rep-only reporting, moderation, clearing approval), and emergency takedown authority. `npx tsc --noEmit` is clean.

## Requirement audit (spec → implementation)

| Area | Where |
| --- | --- |
| Auth, sessions, forced password change, rate-limited login | `src/server/auth.ts`, `src/app/api/auth/*`, `src/app/change-password` |
| Roles & caps (≤1 advisor, ≤4 reps, multi-admin, authority rules) | `src/server/services/roles.ts`, `src/app/api/roles/*`, `tests/roles.test.ts` |
| Dashboard (exactly the 8 required widgets) | `src/app/(app)/home/page.tsx`, `src/app/api/dashboard` |
| Navigation (Home/Timetable/Status/Assignments/Chat/More) | `src/components/nav.tsx` |
| Timetable (8 periods, labs, faculty metadata, advisor/rep editing) | `src/app/(app)/timetable/page.tsx`, `src/app/api/timetable`, `services/timetable.ts` |
| Daily status + out-of-class status (privacy-cut reason) | `src/app/(app)/status/page.tsx`, `services/status.ts`, `tests/privacy.test.ts` |
| Assignments, submissions, counts, resources, archive | `services/assignments.ts`, `src/app/(app)/assignments/*`, `tests/import-assignments.test.ts` |
| Record & Observation (Subject → Experiments) | `services/experiments.ts`, `src/app/(app)/more/record/*` |
| Leave & OD letter chains, withdrawal, advisor-only decisions | `services/leave.ts`, `services/od.ts`, `src/app/(app)/more/{leave,od}`, `tests/workflows.test.ts` |
| Teacher visits (restricted visibility) | `services/visits.ts`, `src/app/(app)/more/visits`, `tests/privacy.test.ts` |
| Chats (class/assignment/experiment), emoji ban, reports, clearing | `services/chat.ts`, `services/clearing.ts`, `src/app/(app)/chat`, `src/app/api/clearing`, `tests/status-chat.test.ts` |
| Notifications (per-category toggles, push when closed, privacy-aware) | `services/notify.ts`, `src/app/api/{notifications,push}`, `src/app/(app)/more/notifications` |
| Excel import (validate/preview/report/first-login passwords) | `services/import.ts`, `src/app/api/import/*` |
| Advisor–student meetings after profile updates | `services/users.ts` (`createMeetingRequest`), `src/app/(app)/more/meetings` |
| Admin console (moderation, roles, audit, overview) | `src/app/console/*`, `src/app/api/console`, `src/app/api/audit` |
| Audit logging | `src/server/audit.ts` (used by every sensitive service action) |
| Files in object storage with ACL streaming | `src/server/files.ts`, `src/app/api/files/*` |
| Realtime (SSE) + offline PWA | `src/server/realtime.ts`, `src/app/api/realtime`, `public/sw.js`, `public/offline.html` |
| Error handling & friendly messages | `src/lib/api.ts` (`handle` wraps every route), error boundaries in `providers.tsx` |

## Deployment

The app is a long-running Node server (API routes, SQLite, filesystem storage, SSE, Web Push) — it needs a host that keeps a process and a disk alive, not a static/Serverless host. Three ready paths:

**1. Docker (any host / VPS / ECS / Coolify / Portainer)**

```bash
docker build -t cse-b-class .
docker run -d --name cse-b-class -p 3000:3000 \
  -v cseb-data:/data \
  -e DATABASE_URL=file:/data/app.db -e STORAGE_DIR=/data/storage \
  -e JWT_SECRET=… -e APP_ORIGIN=https://your-domain -e APP_TZ=Asia/Kolkata \
  -e VAPID_PUBLIC_KEY=… -e VAPID_PRIVATE_KEY=… -e VAPID_SUBJECT=mailto:you@example.com \
  cse-b-class
# first boot only, optional demo class: add -e SEED_DEMO=1
```
Migrations run automatically on every boot; `/data` (volume) holds the DB + uploads.

**2. Fly.io** — `fly launch` from `cse-b-class/` picks up `fly.toml` (Mumbai region, 1 GB persistent volume, always-on machine for SSE/push, health checks, release-command migrations). Then: `fly secrets set JWT_SECRET=… VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… APP_ORIGIN=https://cse-b-class.fly.dev`.

**3. Render** — merge this PR, then Render → "New +" → "Blueprint" → select the repo; `render.yaml` provisions a Node service + 1 GB disk and asks you for `APP_ORIGIN` and the VAPID keys (generate them with `npm run setup` locally). Note: Render's disk requires the paid starter plan — the free plan would wipe the DB/uploads on every restart.

> Why not Vercel/GitHub Pages? Serverless filesystems are ephemeral (SQLite + uploaded letters would vanish) and the repo's existing Pages workflows serve the other, static project in this repo.

**Production checklist:** strong `JWT_SECRET` · VAPID keys set (push won't work without them) · `APP_ORIGIN` = public HTTPS origin · TLS in front (required for PWA install + push on iOS) · back up the database file and `STORAGE_DIR` · skip `SEED_DEMO` and onboard the real class via the Excel import.
