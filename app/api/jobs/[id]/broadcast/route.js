import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Sends a message to every doctor whose own alert criteria (area/dept/shift
// type/weekdays/skills, set by themselves in the alert panel) match what the
// hospital specifies here — NOT a searchable directory. The hospital never
// sees which doctors matched, only how many messages went out; a doctor's
// identity is disclosed to the hospital only if that doctor personally
// replies, same as everywhere else in the app. This keeps the "hospital
// never picks specific job seekers" line that keeps DocLink a
// 募集情報等提供事業 rather than requiring a 職業紹介事業 license — see
// 特定募集情報等提供事業_届出下書き.md.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "hospital") {
    return NextResponse.json({ error: "病院アカウントでログインしてください" }, { status: 403 });
  }
  if (getVerificationStatus(session.userId) !== "approved") {
    return NextResponse.json({ error: PENDING_ACTION_ERROR }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job || job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
  }

  if (job.last_broadcast_at) {
    const nextAllowedAt = new Date(new Date(job.last_broadcast_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (nextAllowedAt > new Date()) {
      return NextResponse.json(
        {
          error: `一斉送信はこの求人につき週1回までです。次回は${nextAllowedAt.toLocaleDateString("ja-JP")}以降に送信できます。`,
        },
        { status: 429 }
      );
    }
  }

  const { area, dept, shiftType, weekdays, skills, message } = await request.json();
  const trimmedMessage = (message || "").trim();
  if (!trimmedMessage) {
    return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  }
  const wantedWeekdays = Array.isArray(weekdays) ? weekdays.filter(Boolean) : [];
  const wantedSkills = Array.isArray(skills) ? skills.filter(Boolean) : [];

  const candidates = db
    .prepare(
      `SELECT u.id, u.email, u.email_notify, a.weekdays AS alert_weekdays, a.skills AS alert_skills
       FROM users u
       JOIN alerts a ON a.user_id = u.id
       WHERE u.role = 'doctor' AND u.deleted_at IS NULL AND u.job_seeking = 1 AND a.active = 1
         AND (? = '' OR a.area = ?)
         AND (? = '' OR a.dept = ?)
         AND (? = '' OR a.shift_type = ?)`
    )
    .all(area || "", area || "", dept || "", dept || "", shiftType || "", shiftType || "");

  const matches = candidates.filter((c) => {
    const docWeekdays = c.alert_weekdays ? c.alert_weekdays.split(",") : [];
    const docSkills = c.alert_skills ? c.alert_skills.split(",") : [];
    const weekdayOk = wantedWeekdays.length === 0 || wantedWeekdays.some((w) => docWeekdays.includes(w));
    const skillOk = wantedSkills.length === 0 || wantedSkills.some((s) => docSkills.includes(s));
    return weekdayOk && skillOk;
  });

  const insertConv = db.prepare(
    "INSERT INTO conversations (job_id, doctor_user_id, anonymous) VALUES (?, ?, 0) ON CONFLICT(job_id, doctor_user_id) DO NOTHING"
  );
  const insertMsg = db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'hospital', ?)"
  );
  const markRead = db.prepare(
    "UPDATE conversations SET last_read_by_hospital = datetime('now') WHERE job_id = ? AND doctor_user_id = ?"
  );

  for (const doctor of matches) {
    insertConv.run(id, doctor.id);
    insertMsg.run(id, doctor.id, session.userId, trimmedMessage);
    markRead.run(id, doctor.id);
    if (doctor.email_notify) {
      sendMail({
        to: doctor.email,
        subject: `【DocLink】${job.hospital_name}からお声がけがあります`,
        text: `${job.hospital_name}が、あなたの希望条件に合う求人「${job.title}」についてメッセージを送りました。\n\n"${trimmedMessage}"\n\n求人ページ: ${APP_URL}/jobs/${id}`,
      }).catch(() => {});
    }
  }

  db.prepare("UPDATE jobs SET last_broadcast_at = datetime('now') WHERE id = ?").run(id);

  return NextResponse.json({ matchedCount: matches.length });
}
