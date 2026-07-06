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
db.pragma("busy_timeout = 5000");

if (!isBuildPhase) {
  runMigrationsAndSeed();
}

function runMigrationsAndSeed() {
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

  // Kept defensive even though this only runs once per real server process
  // now: harmless if a column somehow already exists.
  function addColumnIfMissing(cols, columnName, ddl) {
    if (cols.some((c) => c.name === columnName)) return;
    try {
      db.exec(ddl);
    } catch (e) {
      if (!/duplicate column name/i.test(e.message)) throw e;
    }
  }

  // users.license_number: added later, so backfill for existing dev databases.
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  addColumnIfMissing(userCols, "license_number", "ALTER TABLE users ADD COLUMN license_number TEXT;");
  addColumnIfMissing(userCols, "has_seen_intro", "ALTER TABLE users ADD COLUMN has_seen_intro INTEGER NOT NULL DEFAULT 0;");
  addColumnIfMissing(userCols, "agreed_to_terms_at", "ALTER TABLE users ADD COLUMN agreed_to_terms_at TEXT;");
  addColumnIfMissing(userCols, "specialty", "ALTER TABLE users ADD COLUMN specialty TEXT;");
  addColumnIfMissing(userCols, "phone", "ALTER TABLE users ADD COLUMN phone TEXT;");
  // Doctors can toggle this off when not currently looking, so hospitals
  // can't cold-invite them via the "specific doctor" feature. Doesn't affect
  // the doctor's own ability to message a hospital, only inbound invites.
  addColumnIfMissing(userCols, "job_seeking", "ALTER TABLE users ADD COLUMN job_seeking INTEGER NOT NULL DEFAULT 1;");

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
