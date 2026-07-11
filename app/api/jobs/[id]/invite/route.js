import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Doctors this hospital has already talked to (non-anonymously) about any of
// its postings, so it can invite one of them to a different job — excluding
// whoever's already in a conversation on *this* job (they're reachable from
// the main thread already). Anonymous conversations are excluded: a doctor
// who chose to stay anonymous shouldn't be identifiable/re-targetable by
// name just because they messaged this hospital once before.
export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "hospital") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const contacts = db
    .prepare(
      `SELECT DISTINCT u.id, u.display_name, u.specialty
       FROM conversations c
       JOIN jobs j ON j.id = c.job_id
       JOIN users u ON u.id = c.doctor_user_id
       WHERE j.hospital_user_id = ? AND c.anonymous = 0 AND u.deleted_at IS NULL
         AND c.doctor_user_id NOT IN (
           SELECT doctor_user_id FROM conversations WHERE job_id = ?
         )
       ORDER BY u.display_name`
    )
    .all(session.userId, id);

  return NextResponse.json({
    contacts: contacts.map((c) => ({ doctorUserId: c.id, displayName: c.display_name, specialty: c.specialty || null })),
  });
}

// Hospital-initiated outreach: invite a doctor the hospital has already
// exchanged non-anonymous messages with (about a different job) to look at
// this job too. Deliberately NOT keyed by email/free text — the doctorUserId
// must come from the GET list above, so a hospital can only reach doctors it
// has a real prior (consented, non-anonymous) conversation with, never an
// arbitrary registered account.
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

  const { doctorUserId, message } = await request.json();
  const trimmedMessage = (message || "").trim();
  if (!doctorUserId || !trimmedMessage) {
    return NextResponse.json({ error: "医師とメッセージを選択・入力してください" }, { status: 400 });
  }

  const priorContact = db
    .prepare(
      `SELECT 1 FROM conversations c JOIN jobs j ON j.id = c.job_id
       WHERE j.hospital_user_id = ? AND c.doctor_user_id = ? AND c.anonymous = 0`
    )
    .get(session.userId, doctorUserId);
  if (!priorContact) {
    return NextResponse.json({ error: "この医師とは過去にやり取りがありません" }, { status: 403 });
  }

  const doctor = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'doctor'").get(doctorUserId);
  if (!doctor) {
    return NextResponse.json({ error: "医師が見つかりません" }, { status: 404 });
  }
  if (!doctor.job_seeking) {
    return NextResponse.json(
      { error: "この医師は現在、募集のお声がけを受け付けていません" },
      { status: 403 }
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
