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

  // users.email_notify : per-user toggle for "email me on new chat messages".
  addColumnIfMissing(userCols, "email_notify", "ALTER TABLE users ADD COLUMN email_notify INTEGER NOT NULL DEFAULT 1;");

  // users.verification_status : admin review gate for new signups. Existing
  // accounts (created before this feature) are auto-approved so demo/test data
  // keeps working; only new signups from here on start as 'pending'.
  if (!userCols.some((c) => c.name === "verification_status")) {
    addColumnIfMissing(userCols, "verification_status", "ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending';");
    db.exec("UPDATE users SET verification_status = 'approved';");
  }

  const seedIfEmpty = db.transaction(() => {
    const jobCount = db.prepare("SELECT COUNT(*) AS c FROM jobs").get().c;
    if (jobCount > 0) return;

    const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    let seedHospitalId;
    if (userCount === 0) {
      const bcrypt = require("bcryptjs");
      const hash = bcrypt.hashSync("password123", 10);
      const info = db
        .prepare(
          "INSERT INTO users (email, password_hash, role, display_name, verification_status) VALUES (?, ?, 'hospital', ?, 'approved')"
        )
        .run("demo-hospital@example.com", hash, "関東中央総合病院");
      seedHospitalId = info.lastInsertRowid;
    } else {
      seedHospitalId = db.prepare("SELECT id FROM users WHERE role = 'hospital' LIMIT 1").get()?.id;
    }
    if (!seedHospitalId) return;

    const seedJobs = [
      ["関東中央総合病院", "土曜 日当直医募集（内科）", "日当直", "東京都", "内科", "2026/07/11(土) 9:00〜翌9:00", "日当 80,000円", "一般内科外来・救急対応をお願いします。当直室あり、仮眠可。"],
      ["みなと医療センター", "平日夜間 当直医募集", "当直", "神奈川県", "外科", "2026/07/14(火) 17:00〜翌9:00", "1回 60,000円", "急変対応中心。手術対応はほぼなし。"],
      ["さいたま北クリニック", "週1回 非常勤外来医募集", "非常勤", "埼玉県", "小児科", "毎週水曜 9:00〜13:00", "1回 40,000円", "一般小児外来。継続的にお願いできる方歓迎です。"],
      ["千葉ベイ病院", "休日日直医募集", "日当直", "千葉県", "整形外科", "2026/07/20(日) 9:00〜17:00", "日当 55,000円", "外来・救急対応。整形外科経験者歓迎。"],
      ["水戸メディカルクリニック", "月2回 非常勤（当直）募集", "非常勤", "茨城県", "内科", "応相談（月2回程度）", "1回 65,000円", "内科当直対応。急患少なめの落ち着いた病院です。"],
      ["新宿セントラル病院", "平日夜間 当直医募集（救急）", "当直", "東京都", "救急科", "2026/07/16(木) 18:00〜翌9:00", "1回 75,000円", "二次救急対応。研修医のサポートあり。"],
      ["横浜みなみ病院", "土日 日直医募集", "日当直", "神奈川県", "内科", "2026/07/19(日) 9:00〜17:00", "日当 50,000円", "外来対応中心。急患は少なめです。"],
      ["川口総合クリニック", "週2回 非常勤外来医募集", "非常勤", "埼玉県", "皮膚科", "毎週火・木 13:00〜17:00", "1回 35,000円", "一般皮膚科外来。経験不問。"],
      ["柏記念病院", "月1回 当直医募集", "当直", "千葉県", "産婦人科", "第2土曜 17:00〜翌9:00", "1回 90,000円", "分娩対応可能な方歓迎。オンコール体制あり。"],
      ["つくば中央病院", "平日日中 非常勤医募集", "非常勤", "茨城県", "精神科", "毎週月曜 9:00〜15:00", "1回 55,000円", "外来診察。慢性期患者中心。"],
      ["渋谷駅前クリニック", "土曜 非常勤外来医募集", "非常勤", "東京都", "耳鼻咽喉科", "毎週土曜 9:00〜13:00", "1回 45,000円", "一般耳鼻科外来。駅近で通いやすい立地です。"],
      ["川崎メディカルセンター", "夜間当直医募集（整形）", "当直", "神奈川県", "整形外科", "2026/07/22(水) 18:00〜翌9:00", "1回 70,000円", "外傷対応中心。手術は稀です。"],
      ["浦和厚生病院", "祝日日直医募集", "日当直", "埼玉県", "小児科", "2026/07/23(木祝) 9:00〜17:00", "日当 60,000円", "小児科外来・軽症救急対応。"],
      ["船橋総合クリニック", "週1回 非常勤外来医募集（内科）", "非常勤", "千葉県", "内科", "毎週金曜 9:00〜13:00", "1回 42,000円", "生活習慣病中心の外来診療。"],
      ["土浦中央病院", "当直医募集（麻酔科）", "当直", "茨城県", "麻酔科", "2026/07/25(土) 17:00〜翌9:00", "1回 85,000円", "緊急手術時の麻酔対応。オンコール中心。"],
      ["池袋みらいクリニック", "非常勤外来医募集（皮膚科）", "非常勤", "東京都", "皮膚科", "毎週水曜 14:00〜18:00", "1回 38,000円", "美容皮膚科・一般皮膚科の両方対応可能な方歓迎。"],
      ["藤沢記念病院", "休日当直医募集", "日当直", "神奈川県", "内科・救急科", "2026/07/26(日) 9:00〜翌9:00", "日当 95,000円", "24時間対応。救急経験者歓迎。"],
      ["所沢中央クリニック", "週1回 非常勤医募集（精神科）", "非常勤", "埼玉県", "心療内科", "毎週木曜 9:00〜13:00", "1回 48,000円", "一般外来。カウンセリング経験あれば尚可。"],
    ];
    const insert = db.prepare(
      "INSERT INTO jobs (hospital_user_id, hospital_name, title, type, area, dept, date_text, pay_text, desc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (const j of seedJobs) {
      insert.run(seedHospitalId, ...j);
    }
  });
  seedIfEmpty.immediate();
}

export default db;
