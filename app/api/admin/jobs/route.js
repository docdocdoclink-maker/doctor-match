import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const jobs = db
    .prepare(
      `SELECT j.id, j.title, j.type, j.area, j.hired, j.closed, j.created_at, j.hired_at,
              j.hired_reported_by, j.hired_doctor_user_id, c.hire_confirmed_by_hospital_at,
              j.hospital_name, u.email AS hospital_email, u.phone AS hospital_phone, u.deleted_at AS hospital_deleted_at
       FROM jobs j
       JOIN users u ON u.id = j.hospital_user_id
       LEFT JOIN conversations c ON c.job_id = j.id AND c.doctor_user_id = j.hired_doctor_user_id
       ORDER BY j.created_at DESC`
    )
    .all();

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      type: j.type,
      area: j.area,
      hired: !!j.hired,
      closed: !!j.closed,
      createdAt: j.created_at,
      hiredAt: j.hired_at,
      // Awaiting the hospital's own confirmation on a doctor-reported hire —
      // billing doesn't fire until then (see the confirm-hire route), so a
      // stale one here means the operator should follow up directly.
      awaitingHospitalConfirmation: !!j.hired && j.hired_reported_by === "doctor" && !j.hire_confirmed_by_hospital_at,
      hospitalName: j.hospital_name,
      hospitalEmail: j.hospital_email,
      hospitalPhone: j.hospital_phone,
      hospitalDeleted: !!j.hospital_deleted_at,
    })),
  });
}
