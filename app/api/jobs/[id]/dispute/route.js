import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Either party to a specific conversation can disclose its record to the
// operator. This is the ONLY way a conversation becomes visible to the admin
// panel — see app/api/admin/conversations*. Without this, nobody at DocLink
// can see who's talking to whom, what was said, or who was hired. Disclosing
// a record only grants the operator visibility for their own reference; it
// does not obligate DocLink to mediate or resolve anything (see Terms §5, §7).
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = (body.reason || "").trim();

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }

  let doctorUserId;
  if (session.role === "doctor") {
    doctorUserId = session.userId;
  } else if (session.role === "hospital") {
    if (job.hospital_user_id !== session.userId) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    doctorUserId = Number(body.doctorUserId);
  } else {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorUserId);
  if (!conv) {
    return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });
  }

  db.prepare(
    "UPDATE conversations SET dispute_flagged_at = datetime('now'), dispute_flagged_by = ?, dispute_reason = ? WHERE job_id = ? AND doctor_user_id = ?"
  ).run(session.role, reason || null, id, doctorUserId);

  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(id, doctorUserId, session.userId, "このやり取りの記録が運営に開示されました（運営が仲介・解決を行うものではありません）。");

  return NextResponse.json({ ok: true });
}
