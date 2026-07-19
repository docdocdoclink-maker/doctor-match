import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";
import { sendMail, renderEmailShell } from "@/lib/mailer";
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

  if (session.role === "hospital") {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
    if (!job || job.hospital_user_id !== session.userId) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
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

  // Documents are only ever included once the doctor has opted in to share
  // them for this specific (job, hospital) conversation.
  const documents = conv?.share_documents
    ? db
        .prepare(
          "SELECT id, type, original_name, stored_name, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC"
        )
        .all(doctorId)
    : [];

  return NextResponse.json({
    messages,
    // No conversation yet (first time opening the composer for this job) —
    // default to anonymous so a doctor has to opt into being identified,
    // not the other way around. Once a real conversation row exists, this
    // always reflects whatever the doctor last actually chose, even if
    // that's back to false.
    anonymous: conv ? !!conv.anonymous : true,
    shareDocuments: !!conv?.share_documents,
    documents,
    hireConfirmedByDoctor: !!conv?.hire_confirmed_by_doctor_at,
    hireConfirmedByHospital: !!conv?.hire_confirmed_by_hospital_at,
    hired: !!conv?.hired,
    hiredAt: conv?.hired_at || null,
    hiredReportedBy: conv?.hired_reported_by || null,
    feeWaived: !!conv?.fee_waived,
  });
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
  let shareDocuments = null;
  let doctorId;
  let attachment = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    text = (form.get("text") || "").toString().trim();
    const anonRaw = form.get("anonymous");
    if (anonRaw !== null) anonymous = anonRaw === "true";
    const shareRaw = form.get("shareDocuments");
    if (shareRaw !== null) shareDocuments = shareRaw === "true";
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
    if (typeof body.shareDocuments === "boolean") shareDocuments = body.shareDocuments;
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
  if (text.length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  // Shared documents (resume/license) carry the doctor's real name, so
  // staying anonymous and sharing them at the same time would defeat the
  // anonymity — enforced here too, not just in the UI. Checked against the
  // original request values (not re-checked after mutating), so anonymity
  // wins if a request somehow asks for both.
  if (session.role === "doctor") {
    if (anonymous === true) {
      shareDocuments = false;
    } else if (shareDocuments === true) {
      anonymous = false;
    }
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }
  if (session.role === "hospital" && job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // A hospital can only ever REPLY within an existing thread — one a doctor
  // opened by messaging them, or one their own broadcast created. Creating a
  // brand-new conversation toward an arbitrary doctorId here would let a
  // hospital cold-contact a chosen doctor directly, bypassing the doctor's
  // job_seeking opt-out, the broadcast rate limits, and the "hospital never
  // picks specific job seekers" line that keeps DocLink a 募集情報等提供事業
  // (see the broadcast route). The UI never does this; this guards the API.
  if (session.role === "hospital") {
    const existingConv = db
      .prepare("SELECT job_id FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
      .get(id, doctorId);
    if (!existingConv) {
      return NextResponse.json({ error: "この医師との会話が見つかりません" }, { status: 403 });
    }
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

  // Only the doctor can grant/revoke document-sharing consent, and only for
  // this specific (job, hospital) conversation.
  if (session.role === "doctor" && shareDocuments !== null) {
    db.prepare(
      "UPDATE conversations SET share_documents = ? WHERE job_id = ? AND doctor_user_id = ?"
    ).run(shareDocuments ? 1 : 0, id, doctorId);
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
  const escapedPreview = preview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const link = `${APP_URL}/jobs/${job.id}${senderRole === "doctor" ? "" : ""}`;

  await sendMail({
    to: recipient.email,
    subject: `【DocLink】${job.title} に新着メッセージがあります`,
    text: `${senderLabel}さんからメッセージが届きました。\n\n"${preview}"\n\n返信はこちら: ${link}\n\n---\nこのメールは通知設定をオフにすると届かなくなります。`,
    html: renderEmailShell(`
      <p style="margin:0 0 12px;"><strong>${senderLabel}</strong>さんからメッセージが届きました。</p>
      <blockquote style="margin:0 0 20px; padding:12px 16px; background:#f9fafb; border-left:3px solid #c7dcff; color:#374151; white-space:pre-line;">${escapedPreview}</blockquote>
      <a href="${link}" style="display:inline-block; background:#1a56db; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; padding:10px 20px; border-radius:8px;">求人ページで返信する</a>
    `),
  });
}
