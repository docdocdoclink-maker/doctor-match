import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Per labor bureau guidance, the operator must not have standing access to
// conversation content or to who-was-hired information — only conversations
// a party has explicitly flagged for dispute review (see
// app/api/jobs/[id]/dispute) show up here. This is disclosed in the Terms
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
         c.dispute_flagged_at AS disputeFlaggedAt,
         c.dispute_flagged_by AS disputeFlaggedBy,
         c.dispute_reason AS disputeReason,
         j.title AS jobTitle,
         j.hospital_name AS hospitalName,
         j.hospital_user_id AS hospitalUserId,
         d.display_name AS doctorName,
         (SELECT COUNT(*) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id) AS messageCount,
         (SELECT MAX(created_at) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id) AS lastMessageAt
       FROM conversations c
       JOIN jobs j ON j.id = c.job_id
       JOIN users d ON d.id = c.doctor_user_id
       WHERE c.dispute_flagged_at IS NOT NULL
       ORDER BY c.dispute_flagged_at DESC`
    )
    .all();

  return NextResponse.json({ conversations });
}
