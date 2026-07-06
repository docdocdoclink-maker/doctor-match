import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// The hired doctor confirms the hospital's hire report themselves, so both
// sides end up with an explicit, timestamped record of agreement instead of
// only the hospital's one-sided report.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "doctor") {
    return NextResponse.json({ error: "医師アカウントでログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }
  if (!job.hired || job.hired_doctor_user_id !== session.userId) {
    return NextResponse.json({ error: "確認できる採用報告がありません" }, { status: 403 });
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, session.userId);
  if (!conv) {
    return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });
  }
  if (conv.hire_confirmed_by_doctor_at) {
    return NextResponse.json({ error: "既に確認済みです" }, { status: 409 });
  }

  db.prepare(
    "UPDATE conversations SET hire_confirmed_by_doctor_at = datetime('now') WHERE job_id = ? AND doctor_user_id = ?"
  ).run(id, session.userId);

  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(id, session.userId, session.userId, "医師が採用について同意したことを記録しました。");

  return NextResponse.json({ ok: true });
}
