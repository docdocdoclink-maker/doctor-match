import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Full read-only view of every conversation, for moderation/support
// purposes. Operator access to message content is disclosed in the Terms
// of Service — see app/terms/page.js.
export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const conversations = db
    .prepare(
      `SELECT
         c.job_id AS jobId,
         c.doctor_user_id AS doctorUserId,
         c.anonymous,
         c.created_at AS createdAt,
         j.title AS jobTitle,
         j.hospital_name AS hospitalName,
         j.hospital_user_id AS hospitalUserId,
         d.display_name AS doctorName,
         (SELECT COUNT(*) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id) AS messageCount,
         (SELECT MAX(created_at) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id) AS lastMessageAt
       FROM conversations c
       JOIN jobs j ON j.id = c.job_id
       JOIN users d ON d.id = c.doctor_user_id
       ORDER BY lastMessageAt DESC`
    )
    .all();

  return NextResponse.json({ conversations });
}
