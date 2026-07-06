import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// List conversation threads for a job (hospital-only): one entry per doctor
// who has messaged, showing their name or "匿名の医師" if they chose anonymity.
export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ conversations: [] });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job || (session.role === "hospital" && job.hospital_user_id !== session.userId)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const rows = db
    .prepare(
      `SELECT c.doctor_user_id, c.anonymous, u.display_name, u.specialty,
              a.area AS desired_area, a.type AS desired_type, a.dept AS desired_dept, a.note AS desired_note,
              (SELECT text FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_text,
              (SELECT created_at FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_at
       FROM conversations c
       JOIN users u ON u.id = c.doctor_user_id
       LEFT JOIN alerts a ON a.user_id = c.doctor_user_id
       WHERE c.job_id = ?
       ORDER BY last_at DESC`
    )
    .all(id);

  const conversations = rows.map((r) => ({
    doctorUserId: r.doctor_user_id,
    displayName: r.anonymous ? "匿名の医師" : r.display_name,
    specialty: r.specialty || null,
    anonymous: !!r.anonymous,
    lastText: r.last_text,
    lastAt: r.last_at,
    desiredArea: r.desired_area || null,
    desiredType: r.desired_type || null,
    desiredDept: r.desired_dept || null,
    desiredNote: r.desired_note || null,
  }));

  return NextResponse.json({ conversations });
}
