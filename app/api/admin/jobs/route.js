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
      `SELECT j.id, j.title, j.type, j.area, j.closed, j.created_at,
              j.hospital_name, u.email AS hospital_email, u.phone AS hospital_phone, u.deleted_at AS hospital_deleted_at
       FROM jobs j
       JOIN users u ON u.id = j.hospital_user_id
       ORDER BY j.created_at DESC`
    )
    .all();

  // A job can have several independent hires (see conversations.hired) —
  // one row per (job, doctor) that's been reported hired, not one per job.
  const hireRows = db
    .prepare(
      `SELECT c.job_id, c.doctor_user_id, c.hired_at, c.hired_reported_by, c.hire_confirmed_by_hospital_at,
              d.display_name AS doctor_name
       FROM conversations c
       JOIN users d ON d.id = c.doctor_user_id
       WHERE c.hired = 1`
    )
    .all();
  const hiresByJob = new Map();
  for (const h of hireRows) {
    const list = hiresByJob.get(h.job_id) || [];
    list.push({
      doctorUserId: h.doctor_user_id,
      doctorName: h.doctor_name,
      hiredAt: h.hired_at,
      hiredReportedBy: h.hired_reported_by,
      // Awaiting the hospital's own confirmation on a doctor-reported hire —
      // billing doesn't fire until then (see the confirm-hire route), so a
      // stale one here means the operator should follow up directly.
      awaitingHospitalConfirmation: h.hired_reported_by === "doctor" && !h.hire_confirmed_by_hospital_at,
    });
    hiresByJob.set(h.job_id, list);
  }

  return NextResponse.json({
    jobs: jobs.map((j) => {
      const hires = hiresByJob.get(j.id) || [];
      return {
        id: j.id,
        title: j.title,
        type: j.type,
        area: j.area,
        closed: !!j.closed,
        createdAt: j.created_at,
        hires,
        awaitingConfirmationCount: hires.filter((h) => h.awaitingHospitalConfirmation).length,
        hospitalName: j.hospital_name,
        hospitalEmail: j.hospital_email,
        hospitalPhone: j.hospital_phone,
        hospitalDeleted: !!j.hospital_deleted_at,
      };
    }),
  });
}
