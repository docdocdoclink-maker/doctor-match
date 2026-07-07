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
      `SELECT j.id, j.title, j.type, j.area, j.hired, j.closed, j.created_at,
              j.hospital_name, u.email AS hospital_email, u.phone AS hospital_phone, u.deleted_at AS hospital_deleted_at
       FROM jobs j
       JOIN users u ON u.id = j.hospital_user_id
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
      hospitalName: j.hospital_name,
      hospitalEmail: j.hospital_email,
      hospitalPhone: j.hospital_phone,
      hospitalDeleted: !!j.hospital_deleted_at,
    })),
  });
}
