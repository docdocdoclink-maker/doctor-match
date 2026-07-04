import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";
import { sendMail } from "@/lib/mailer";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Resolve which doctor's conversation thread we're looking at.
// - Doctors always see their own thread.
// - Hospitals must specify ?doctorId= to pick a specific doctor's thread,
//   since a job can have messages from several different doctors.
async function resolveDoctorId(request, session) {
  if (session.role === "doctor") return session.userId;
  const url = new URL(request.url);
  const doctorId = url.searchParams.get("doctorId");
  return doctorId ? Number(doctorId) : null;
}

export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ messages: [] });
  }

  const doctorId = await resolveDoctorId(request, session);
  if (!doctorId) {
    return NextResponse.json({ messages: [] });
  }

  const messages = db
    .prepare(
      "SELECT * FROM messages WHERE job_id = ? AND doctor_user_id = ? ORDER BY created_at ASC"
    )
    .all(id, doctorId);

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorId);

  // Viewing the thread marks it as read for whichever side is looking at it.
  if (conv) {
    const col = session.role === "doctor" ? "last_read_by_doctor" : "last_read_by_hospital";
    db.prepare(
      `UPDATE conversations SET ${col} = datetime('now') WHERE job_id = ? AND doctor_user_id = ?`
    ).run(id, doctorId);
  }

  return NextResponse.json({ messages, anonymous: !!conv?.anonymous });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  if (getVerificationStatus(session.userId) !== "approved") {
    return NextResponse.json({ error: PENDING_ACTION_ERROR }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  let text = "";
  let anonymous = null;
  let doctorId;
  let attachment = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    text = (form.get("text") || "").toString().trim();
    const anonRaw = form.get("anonymous");
    if (anonRaw !== null) anonymous = anonRaw === "true";
    const file = form.get("file");
    if (file && typeof file === "object" && file.size > 0) {
      try {
        attachment = await saveUpload(file);
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    if (session.role === "hospital") {
      doctorId = Number(form.get("doctorId"));
    }
  } else {
    const body = await request.json();
    text = (body.text || "").trim();
    if (typeof body.anonymous === "boolean") anonymous = body.anonymous;
    if (session.role === "hospital") doctorId = Number(body.doctorId);
  }

  if (session.role === "doctor") {
    doctorId = session.userId;
  }
  if (!doctorId) {
    return NextResponse.json({ error: "会話の相手が指定されていません" }, { status: 400 });
  }
  if (!text && !attachment) {
    return NextResponse.json({ error: "メッセージまたはファイルを入力してください" }, { status: 400 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }
  if (session.role === "hospital" && job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // Ensure a conversation row exists for this (job, doctor) pair.
  db.prepare(
    "INSERT INTO conversations (job_id, doctor_user_id, anonymous) VALUES (?, ?, ?) ON CONFLICT(job_id, doctor_user_id) DO NOTHING"
  ).run(id, doctorId, anonymous ? 1 : 0);

  if (session.role === "doctor" && anonymous !== null) {
    db.prepare(
      "UPDATE conversations SET anonymous = ? WHERE job_id = ? AND doctor_user_id = ?"
    ).run(anonymous ? 1 : 0, id, doctorId);
  }

  const info = db
    .prepare(
      `INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text, attachment_name, attachment_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      doctorId,
      session.userId,
      session.role,
      text,
      attachment?.originalName || null,
      attachment?.storedName || null
    );

  // Sending a message implies you've read up to now yourself.
  const readCol = session.role === "doctor" ? "last_read_by_doctor" : "last_read_by_hospital";
  db.prepare(
    `UPDATE conversations SET ${readCol} = datetime('now') WHERE job_id = ? AND doctor_user_id = ?`
  ).run(id, doctorId);

  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(info.lastInsertRowid);

  // Best-effort email notification to whichever side did NOT just send this.
  notifyRecipient({ job, doctorId, senderRole: session.role, anonymous, text, hasAttachment: !!attachment }).catch(
    () => {}
  );

  return NextResponse.json({ message });
}

async function notifyRecipient({ job, doctorId, senderRole, anonymous, text, hasAttachment }) {
  const recipient =
    senderRole === "doctor"
      ? db.prepare("SELECT * FROM users WHERE id = ?").get(job.hospital_user_id)
      : db.prepare("SELECT * FROM users WHERE id = ?").get(doctorId);
  if (!recipient || !recipient.email_notify) return;

  const senderLabel =
    senderRole === "doctor" ? (anonymous ? "匿名の医師" : "医師") : job.hospital_name;
  const preview = hasAttachment ? `${text || "（書類が添付されました）"}` : text;
  const link = `${APP_URL}/jobs/${job.id}${senderRole === "doctor" ? "" : ""}`;

  await sendMail({
    to: recipient.email,
    subject: `【DocLink】${job.title} に新着メッセージがあります`,
    text: `${senderLabel}さんからメッセージが届きました。\n\n"${preview}"\n\n返信はこちら: ${link}\n\n---\nこのメールは通知設定をオフにすると届かなくなります。`,
    html: `<p><strong>${senderLabel}</strong>さんからメッセージが届きました。</p><blockquote>${preview}</blockquote><p><a href="${link}">求人ページで返信する</a></p>`,
  });
}
