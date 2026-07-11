import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Whichever side did NOT report the hire (see jobs.hired_reported_by)
// confirms it themselves, so both sides end up with an explicit, timestamped
// record of agreement instead of only one side's report.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || (session.role !== "hospital" && session.role !== "doctor")) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job || !job.hired) {
    return NextResponse.json({ error: "確認できる採用報告がありません" }, { status: 403 });
  }

  let doctorUserId;
  if (session.role === "doctor") {
    if (job.hired_reported_by !== "hospital" || job.hired_doctor_user_id !== session.userId) {
      return NextResponse.json({ error: "確認できる採用報告がありません" }, { status: 403 });
    }
    doctorUserId = session.userId;
  } else {
    if (job.hired_reported_by !== "doctor" || job.hospital_user_id !== session.userId) {
      return NextResponse.json({ error: "確認できる採用報告がありません" }, { status: 403 });
    }
    doctorUserId = job.hired_doctor_user_id;
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorUserId);
  if (!conv) {
    return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });
  }

  const column = session.role === "doctor" ? "hire_confirmed_by_doctor_at" : "hire_confirmed_by_hospital_at";
  if (conv[column]) {
    return NextResponse.json({ error: "既に確認済みです" }, { status: 409 });
  }

  db.prepare(
    `UPDATE conversations SET ${column} = datetime('now') WHERE job_id = ? AND doctor_user_id = ?`
  ).run(id, doctorUserId);

  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(
    id,
    doctorUserId,
    session.userId,
    session.role === "doctor" ? "医師が採用について同意したことを記録しました。" : "病院が採用について確認したことを記録しました。"
  );

  return NextResponse.json({ ok: true });
}
