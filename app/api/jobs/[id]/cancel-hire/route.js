import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Lets whoever reported a hire take it back, but only while the other side
// hasn't confirmed yet — a misclick undo, not a way to unwind an agreement
// both parties already recorded. Once confirmed, walking it back needs the
// Contact flow like any other dispute, not a self-service button. Scoped to
// one (job, doctor) conversation, since a job can have several independent
// hires.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || (session.role !== "hospital" && session.role !== "doctor")) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }

  let doctorUserId;
  if (session.role === "hospital") {
    if (job.hospital_user_id !== session.userId) {
      return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    doctorUserId = Number(body.doctorUserId);
    if (!doctorUserId) {
      return NextResponse.json({ error: "対象の医師を選択してください" }, { status: 400 });
    }
  } else {
    doctorUserId = session.userId;
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorUserId);
  if (!conv || !conv.hired) {
    return NextResponse.json({ error: "取り消せる採用報告がありません" }, { status: 403 });
  }
  if (conv.hired_reported_by !== session.role) {
    return NextResponse.json({ error: "自分が報告した採用報告のみ取り消せます" }, { status: 403 });
  }

  // The relevant confirmation is whichever side did NOT report it — i.e. the
  // opposite of session.role, which we already know equals hired_reported_by
  // at this point (checked above).
  const confirmedColumn = conv.hired_reported_by === "hospital" ? "hire_confirmed_by_doctor_at" : "hire_confirmed_by_hospital_at";
  if (conv[confirmedColumn]) {
    return NextResponse.json({ error: "相手が既に確認済みのため取り消せません。お問い合わせフォームからご連絡ください。" }, { status: 409 });
  }

  db.prepare(
    `UPDATE conversations SET hired = 0, hired_at = NULL, hired_reported_by = NULL,
       hire_confirmed_by_doctor_at = NULL, hire_confirmed_by_hospital_at = NULL
     WHERE job_id = ? AND doctor_user_id = ?`
  ).run(id, doctorUserId);

  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(
    id,
    doctorUserId,
    session.userId,
    session.role === "hospital" ? "病院が採用報告を取り消しました。" : "医師が採用報告を取り消しました。"
  );

  return NextResponse.json({ ok: true });
}
