import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Hospital-initiated outreach: invite a specific, already-registered doctor
// (by email) to look at this job, seeding the conversation with an opening
// message from the hospital. This does NOT let the hospital pick doctors it
// has no relationship with beyond an email address it already has, and it
// never exposes a directory of doctors to browse/select from.
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

  const { email, message } = await request.json();
  const trimmedEmail = (email || "").trim();
  const trimmedMessage = (message || "").trim();
  if (!trimmedEmail || !trimmedMessage) {
    return NextResponse.json({ error: "医師のメールアドレスとメッセージを入力してください" }, { status: 400 });
  }

  const doctor = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'doctor'").get(trimmedEmail);
  if (!doctor) {
    return NextResponse.json(
      { error: "このメールアドレスで登録された医師アカウントが見つかりません" },
      { status: 404 }
    );
  }

  db.prepare(
    "INSERT INTO conversations (job_id, doctor_user_id, anonymous) VALUES (?, ?, 0) ON CONFLICT(job_id, doctor_user_id) DO NOTHING"
  ).run(id, doctor.id);

  const info = db
    .prepare(
      "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'hospital', ?)"
    )
    .run(id, doctor.id, session.userId, trimmedMessage);

  db.prepare(
    "UPDATE conversations SET last_read_by_hospital = datetime('now') WHERE job_id = ? AND doctor_user_id = ?"
  ).run(id, doctor.id);

  if (doctor.email_notify) {
    await sendMail({
      to: doctor.email,
      subject: `【DocLink】${job.hospital_name}からお声がけがあります`,
      text: `${job.hospital_name}があなたに求人「${job.title}」についてメッセージを送りました。\n\n"${trimmedMessage}"\n\n求人ページ: ${APP_URL}/jobs/${id}`,
    });
  }

  const message_row = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ message: message_row, doctorId: doctor.id });
}
