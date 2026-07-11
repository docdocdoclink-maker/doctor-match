import Database from "better-sqlite3";
import path from "path";
import { DATA_DIR } from "./dataDir";

// Next.js's production build loads every route module from several
// parallel workers just to inspect its exports ("collecting page data").
// A persistent volume (DATA_DIR) is only mounted into the real runtime
// container, not the build container, so opening a file there during
// build would crash even before any migration runs. Use an in-memory DB
// during build — nothing needs to persist, we're just avoiding a crash —
// and skip migrations/seeding too, since none of that matters at build time.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const dbPath = isBuildPhase ? ":memory:" : path.join(DATA_DIR, "doctormatch.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
// 30s, not 5s: on Railway, a new deploy's process starts running these
// migrations while the previous deploy's process may still be holding the
// same volume-backed file, and a short timeout was still hitting SQLITE_BUSY
// often enough to crash the boot (see the try/catch below and in
// addColumnIfMissing) even after busy_timeout was first added.
db.pragma("busy_timeout = 30000");

if (!isBuildPhase) {
  runMigrationsAndSeed();
}

function runMigrationsAndSeed() {
  try {
    db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'hospital')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_user_id INTEGER NOT NULL REFERENCES users(id),
  hospital_name TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  area TEXT NOT NULL,
  dept TEXT NOT NULL,
  date_text TEXT NOT NULL,
  pay_text TEXT NOT NULL,
  desc TEXT NOT NULL,
  hired INTEGER NOT NULL DEFAULT 0,
  hired_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 0,
  area TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  dept TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('resume', 'license')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
  } catch (e) {
    // Same volume-lock contention as addColumnIfMissing below, just for the
    // CREATE TABLE IF NOT EXISTS statements instead of an ALTER TABLE. On any
    // boot after the very first, these tables already exist, so a busy lock
    // here is safe to skip past — crashing over it was strictly worse.
    if (e.code !== "SQLITE_BUSY") throw e;
    // eslint-disable-next-line no-console
    console.warn(`[db] skipped CREATE TABLE pass (tables should already exist): ${e.message}`);
  }

  // Defensive against two things that can happen when a new deploy's process
  // starts running these migrations while the previous deploy's process is
  // still holding the same volume-backed SQLite file: (1) "duplicate column
  // name" if the old process's own migration already added it, and (2)
  // SQLITE_BUSY if the old process is mid-write and this process's ALTER
  // can't get the lock within busy_timeout. Neither is fatal — either the
  // column already exists, or it will once whichever process wins finishes —
  // so log and move on instead of crashing the whole boot over it.
  function addColumnIfMissing(cols, columnName, ddl) {
    if (cols.some((c) => c.name === columnName)) return;
    try {
      db.exec(ddl);
    } catch (e) {
      if (/duplicate column name/i.test(e.message) || e.code === "SQLITE_BUSY") {
        // eslint-disable-next-line no-console
        console.warn(`[db] skipped migration for ${columnName}: ${e.message}`);
        return;
      }
      throw e;
    }
  }

  // users.license_number: added later, so backfill for existing dev databases.
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  addColumnIfMissing(userCols, "license_number", "ALTER TABLE users ADD COLUMN license_number TEXT;");
  addColumnIfMissing(userCols, "has_seen_intro", "ALTER TABLE users ADD COLUMN has_seen_intro INTEGER NOT NULL DEFAULT 0;");
  addColumnIfMissing(userCols, "agreed_to_terms_at", "ALTER TABLE users ADD COLUMN agreed_to_terms_at TEXT;");
  addColumnIfMissing(userCols, "specialty", "ALTER TABLE users ADD COLUMN specialty TEXT;");
  // Doctor's own employment-style preference (常勤/非常勤/スポット) — shown to
  // hospitals alongside specialty, see lib/jobOptions.js EMPLOYMENT_PREFERENCES.
  addColumnIfMissing(userCols, "desired_employment_type", "ALTER TABLE users ADD COLUMN desired_employment_type TEXT;");
  addColumnIfMissing(userCols, "phone", "ALTER TABLE users ADD COLUMN phone TEXT;");
  // Doctors can toggle this off when not currently looking, so hospitals
  // can't cold-invite them via the "specific doctor" feature. Doesn't affect
  // the doctor's own ability to message a hospital, only inbound invites.
  addColumnIfMissing(userCols, "job_seeking", "ALTER TABLE users ADD COLUMN job_seeking INTEGER NOT NULL DEFAULT 1;");

  // users.reset_token / reset_token_expires_at : "forgot password" flow.
  // Single active token per user is enough — requesting a new one
  // overwrites the old, so an unused old link stops working.
  addColumnIfMissing(userCols, "reset_token", "ALTER TABLE users ADD COLUMN reset_token TEXT;");
  addColumnIfMissing(userCols, "reset_token_expires_at", "ALTER TABLE users ADD COLUMN reset_token_expires_at TEXT;");

  // users.deleted_at : admin-facing soft delete. Deactivates the account
  // (login blocked) without erasing it, so an accidental deletion can be
  // undone. A hospital's own job postings are closed at the same time (see
  // the admin delete route) but not automatically reopened on restore.
  addColumnIfMissing(userCols, "deleted_at", "ALTER TABLE users ADD COLUMN deleted_at TEXT;");

  // users.original_email : email is UNIQUE, so a soft-deleted row would
  // otherwise permanently block that address from signing up again. On
  // delete, the real email moves here and the `email` column is replaced
  // with a mangled placeholder; restore reverses that. See the delete/
  // restore routes.
  addColumnIfMissing(userCols, "original_email", "ALTER TABLE users ADD COLUMN original_email TEXT;");

  // jobs.emergency_volume / night_duty_note / backup_note: optional context
  // hospitals can fill in about actual on-call conditions, so doctors have a
  // bit more than just pay/schedule to judge a listing by. All optional —
  // the posting form still works fine with them left blank.
  const jobCols = db.prepare("PRAGMA table_info(jobs)").all();
  addColumnIfMissing(jobCols, "emergency_volume", "ALTER TABLE jobs ADD COLUMN emergency_volume TEXT;");
  addColumnIfMissing(jobCols, "night_duty_note", "ALTER TABLE jobs ADD COLUMN night_duty_note TEXT;");
  addColumnIfMissing(jobCols, "backup_note", "ALTER TABLE jobs ADD COLUMN backup_note TEXT;");
  addColumnIfMissing(jobCols, "hospital_website", "ALTER TABLE jobs ADD COLUMN hospital_website TEXT;");
  addColumnIfMissing(jobCols, "access", "ALTER TABLE jobs ADD COLUMN access TEXT;");

  // jobs.closed : lets a hospital withdraw a posting (filled elsewhere, no
  // longer needed, etc.) without deleting it, and bring it back later by
  // flipping this off again. Independent of `hired`, which records an actual
  // DocLink match — a job can be closed without ever being hired.
  addColumnIfMissing(jobCols, "closed", "ALTER TABLE jobs ADD COLUMN closed INTEGER NOT NULL DEFAULT 0;");

  addColumnIfMissing(jobCols, "outpatient_volume", "ALTER TABLE jobs ADD COLUMN outpatient_volume TEXT;");

  // jobs.last_broadcast_at : when the hospital last used "条件に合う医師に
  // 一斉送信する" for this job. Rate-limited to once a week per job (see the
  // broadcast route) so a hospital can't spam every matching doctor's alert
  // inbox on repeat.
  addColumnIfMissing(jobCols, "last_broadcast_at", "ALTER TABLE jobs ADD COLUMN last_broadcast_at TEXT;");

  // jobs.work_date / jobs.pay_amount : structured counterparts to the
  // free-text date_text/pay_text (which can't be sorted reliably — hospitals
  // write things like "応相談" or "土日いずれか"). Nullable because postings
  // made before this migration won't have them until the hospital re-saves
  // via the edit form; the "勤務日が近い順"/"報酬が高い順" sorts on the job
  // list push null values to the end rather than erroring.
  addColumnIfMissing(jobCols, "work_date", "ALTER TABLE jobs ADD COLUMN work_date TEXT;");
  addColumnIfMissing(jobCols, "pay_amount", "ALTER TABLE jobs ADD COLUMN pay_amount INTEGER;");

  // jobs.work_date_ongoing : for recurring/standing postings ("every
  // Friday", "any time") where a single work_date would go stale the moment
  // it's in the past and the hospital hasn't revisited the listing. When
  // set, the "勤務日が近い順" sort treats the job as always-soonest instead
  // of requiring a real date.
  addColumnIfMissing(jobCols, "work_date_ongoing", "ALTER TABLE jobs ADD COLUMN work_date_ongoing INTEGER NOT NULL DEFAULT 0;");

  // jobs.click_count : incremented each time the job detail page is loaded
  // (see GET /api/jobs/[id]), backing the "クリック数が多い順" sort.
  addColumnIfMissing(jobCols, "click_count", "ALTER TABLE jobs ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;");

  // jobs.city : optional free-text city/ward within the prefecture (area).
  // Free text rather than a fixed list — a full 市区町村 list across all 5
  // prefectures is 200+ entries, and any gap in it would block a real
  // hospital from posting accurately. Narrows the /jobs listing on top of
  // the existing prefecture filter; leaving it blank still browses the
  // whole prefecture like before.
  addColumnIfMissing(jobCols, "city", "ALTER TABLE jobs ADD COLUMN city TEXT;");

  // jobs.hired_doctor_user_id : which doctor a hire report refers to (a job
  // can have several conversing doctors, but only one gets hired). Lets the
  // hire flow tell the hired doctor apart from the others instead of sending
  // everyone the same "hired!" message, and lets that doctor confirm the
  // hire themselves (see conversations.hire_confirmed_by_doctor_at below).
  addColumnIfMissing(jobCols, "hired_doctor_user_id", "ALTER TABLE jobs ADD COLUMN hired_doctor_user_id INTEGER REFERENCES users(id);");

  // jobs.hired_reported_by : which side reported the hire ('hospital' or
  // 'doctor') — either can now report it. Determines who's left to confirm:
  // if the hospital reported, the hired doctor confirms
  // (conversations.hire_confirmed_by_doctor_at); if the doctor reported, the
  // hospital confirms (conversations.hire_confirmed_by_hospital_at, below).
  addColumnIfMissing(jobCols, "hired_reported_by", "ALTER TABLE jobs ADD COLUMN hired_reported_by TEXT;");

  // alerts.note : besides the area/type/dept filters (used for notification
  // matching), doctors can jot a free-text note about what they're looking
  // for. Shown to a hospital once a doctor has started a conversation with
  // them, so the hospital has some idea what the doctor wants before replying.
  const alertCols = db.prepare("PRAGMA table_info(alerts)").all();
  addColumnIfMissing(alertCols, "note", "ALTER TABLE alerts ADD COLUMN note TEXT NOT NULL DEFAULT '';");

  // alerts.shift_type / weekdays / skills : finer-grained matching criteria
  // than area/type/dept, added so a hospital's broadcast-to-matching-doctors
  // feature can target e.g. "day-shift endoscopy on Wednesdays" instead of
  // just an area/department. weekdays and skills are comma-separated lists
  // (SQLite has no array column) — see lib/jobOptions.js for the fixed
  // option sets (SHIFT_TYPES, WEEKDAYS, SKILLS) these are drawn from.
  addColumnIfMissing(alertCols, "shift_type", "ALTER TABLE alerts ADD COLUMN shift_type TEXT NOT NULL DEFAULT '';");
  addColumnIfMissing(alertCols, "weekdays", "ALTER TABLE alerts ADD COLUMN weekdays TEXT NOT NULL DEFAULT '';");
  addColumnIfMissing(alertCols, "skills", "ALTER TABLE alerts ADD COLUMN skills TEXT NOT NULL DEFAULT '';");

  // jobs.confirmed_at : the last time the hospital confirmed this posting is
  // still accurate. Set to created_at on insert; existing rows backfill to
  // their own created_at so doctors always see some date, not a blank.
  if (!jobCols.some((c) => c.name === "confirmed_at")) {
    db.exec("ALTER TABLE jobs ADD COLUMN confirmed_at TEXT;");
    db.exec("UPDATE jobs SET confirmed_at = created_at WHERE confirmed_at IS NULL;");
  }

  // --- messages/conversations schema migration ---
  // A "conversation" is keyed by (job_id, doctor_user_id) so that when multiple
  // doctors message the same job, the hospital sees separate threads instead of
  // one merged conversation.
  const messageCols = db.prepare("PRAGMA table_info(messages)").all();
  const hasThreadedSchema = messageCols.some((c) => c.name === "doctor_user_id");
  if (messageCols.length > 0 && !hasThreadedSchema) {
    // Old flat-thread schema from an earlier prototype iteration. This is local
    // dev/demo data only, so we just rebuild rather than write a real migration.
    db.exec("DROP TABLE IF EXISTS messages;");
  }

  db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  doctor_user_id INTEGER NOT NULL REFERENCES users(id),
  anonymous INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_read_by_doctor TEXT,
  last_read_by_hospital TEXT,
  PRIMARY KEY (job_id, doctor_user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  doctor_user_id INTEGER NOT NULL REFERENCES users(id),
  sender_user_id INTEGER REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('doctor', 'hospital', 'system')),
  text TEXT NOT NULL DEFAULT '',
  attachment_name TEXT,
  attachment_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

  // conversations.last_read_by_* : added later, backfill for existing dev DBs.
  const convCols = db.prepare("PRAGMA table_info(conversations)").all();
  addColumnIfMissing(convCols, "last_read_by_doctor", "ALTER TABLE conversations ADD COLUMN last_read_by_doctor TEXT;");
  addColumnIfMissing(convCols, "last_read_by_hospital", "ALTER TABLE conversations ADD COLUMN last_read_by_hospital TEXT;");

  // conversations.share_documents : doctor's per-conversation consent to let
  // this specific hospital view their uploaded resume/license documents.
  // Off by default — the hospital never sees profile documents unless the
  // doctor explicitly opts in for that job/conversation.
  addColumnIfMissing(convCols, "share_documents", "ALTER TABLE conversations ADD COLUMN share_documents INTEGER NOT NULL DEFAULT 0;");

  // conversations.hire_confirmed_by_doctor_at : set when the hired doctor
  // explicitly confirms a hire the hospital reported. Gives both sides a
  // clear, timestamped record that they agree a hire happened, so nobody
  // has to rely on re-reading the free-text chat to settle a dispute later.
  addColumnIfMissing(convCols, "hire_confirmed_by_doctor_at", "ALTER TABLE conversations ADD COLUMN hire_confirmed_by_doctor_at TEXT;");

  // conversations.hire_confirmed_by_hospital_at : the mirror of the above,
  // for when the doctor is the one who reported the hire — the hospital
  // confirms it instead. See jobs.hired_reported_by.
  addColumnIfMissing(convCols, "hire_confirmed_by_hospital_at", "ALTER TABLE conversations ADD COLUMN hire_confirmed_by_hospital_at TEXT;");

  // conversations.dispute_flagged_* : per labor bureau guidance, the operator
  // must not have standing access to conversation content or to who-was-hired
  // information — only once a party to that specific conversation flags a
  // dispute should the admin be able to open it. See ChatsTab in app/admin
  // and app/api/admin/conversations*.
  addColumnIfMissing(convCols, "dispute_flagged_at", "ALTER TABLE conversations ADD COLUMN dispute_flagged_at TEXT;");
  addColumnIfMissing(convCols, "dispute_flagged_by", "ALTER TABLE conversations ADD COLUMN dispute_flagged_by TEXT;");
  addColumnIfMissing(convCols, "dispute_reason", "ALTER TABLE conversations ADD COLUMN dispute_reason TEXT;");

  // users.email_notify : per-user toggle for "email me on new chat messages".
  addColumnIfMissing(userCols, "email_notify", "ALTER TABLE users ADD COLUMN email_notify INTEGER NOT NULL DEFAULT 1;");

  // users.verification_status : admin review gate for new signups. Existing
  // accounts (created before this feature) are auto-approved so demo/test data
  // keeps working; only new signups from here on start as 'pending'.
  if (!userCols.some((c) => c.name === "verification_status")) {
    addColumnIfMissing(userCols, "verification_status", "ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending';");
    db.exec("UPDATE users SET verification_status = 'approved';");
  }

}

export default db;
