import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Cross-job conversation list for the logged-in user, with unread counts.
// - Doctor: every conversation they're part of, across all jobs.
// - Hospital: every conversation on every job they posted.
export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ conversations: [], unreadTotal: 0 });
  }

  let rows;
  if (session.role === "doctor") {
    rows = db
      .prepare(
        `SELECT c.job_id, c.doctor_user_id, c.anonymous, c.last_read_by_doctor,
                j.title, j.hospital_name, j.hired,
                (SELECT text FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_text,
                (SELECT created_at FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_at,
                (SELECT COUNT(*) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id AND m.sender_role != 'doctor' AND m.created_at > COALESCE(c.last_read_by_doctor, '0000-00-00')) AS unread
         FROM conversations c
         JOIN jobs j ON j.id = c.job_id
         WHERE c.doctor_user_id = ?
         ORDER BY last_at DESC`
      )
      .all(session.userId);
    rows = rows.map((r) => ({
      jobId: r.job_id,
      doctorUserId: r.doctor_user_id,
      title: r.title,
      counterpart: r.hospital_name,
      hired: !!r.hired,
      lastText: r.last_text,
      lastAt: r.last_at,
      unread: r.unread,
    }));
  } else {
    rows = db
      .prepare(
        `SELECT c.job_id, c.doctor_user_id, c.anonymous, c.last_read_by_hospital,
                j.title, j.hired, u.display_name AS doctor_name, u.specialty,
                (SELECT text FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_text,
                (SELECT created_at FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id ORDER BY m.created_at DESC LIMIT 1) AS last_at,
                (SELECT COUNT(*) FROM messages m WHERE m.job_id = c.job_id AND m.doctor_user_id = c.doctor_user_id AND m.sender_role != 'hospital' AND m.created_at > COALESCE(c.last_read_by_hospital, '0000-00-00')) AS unread
         FROM conversations c
         JOIN jobs j ON j.id = c.job_id
         JOIN users u ON u.id = c.doctor_user_id
         WHERE j.hospital_user_id = ?
         ORDER BY last_at DESC`
      )
      .all(session.userId);
    rows = rows.map((r) => ({
      jobId: r.job_id,
      doctorUserId: r.doctor_user_id,
      title: r.title,
      counterpart: r.anonymous ? "匿名の医師" : r.doctor_name,
      specialty: r.specialty || null,
      hired: !!r.hired,
      lastText: r.last_text,
      lastAt: r.last_at,
      unread: r.unread,
    }));
  }

  const unreadTotal = rows.reduce((sum, r) => sum + (r.unread || 0), 0);
  return NextResponse.json({ conversations: rows, unreadTotal });
}
