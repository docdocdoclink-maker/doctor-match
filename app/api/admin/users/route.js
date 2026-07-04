import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const users = db
    .prepare(
      `SELECT id, email, role, display_name, license_number, specialty, created_at, verification_status, email_notify
       FROM users ORDER BY created_at DESC`
    )
    .all();

  const docsStmt = db.prepare("SELECT id, type, original_name, stored_name FROM documents WHERE user_id = ?");
  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.display_name,
    licenseNumber: u.license_number,
    specialty: u.specialty,
    createdAt: u.created_at,
    verificationStatus: u.verification_status,
    emailNotify: !!u.email_notify,
    documents: u.role === "doctor" ? docsStmt.all(u.id) : [],
  }));

  return NextResponse.json({ users: result });
}
