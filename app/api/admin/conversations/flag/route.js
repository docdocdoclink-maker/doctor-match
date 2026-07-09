import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Lets admin flag a conversation for review themselves, for cases where a
// party reported an issue via Contact (rather than flagging it from inside
// the conversation). Deliberately silent — no system message is posted to
// the thread, so neither party is tipped off that the conversation is under
// review. Content is still never visible until this runs.
export async function POST(request) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { jobId, doctorId, reason } = await request.json();
  if (!jobId || !doctorId) {
    return NextResponse.json({ error: "jobId, doctorId が必要です" }, { status: 400 });
  }

  const conv = db.prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?").get(jobId, doctorId);
  if (!conv) {
    return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });
  }

  db.prepare(
    "UPDATE conversations SET dispute_flagged_at = datetime('now'), dispute_flagged_by = 'admin', dispute_reason = ? WHERE job_id = ? AND doctor_user_id = ?"
  ).run(reason || null, jobId, doctorId);

  return NextResponse.json({ ok: true });
}
