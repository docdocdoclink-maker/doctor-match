import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Soft delete: deactivates the account (login blocked, verification status
// forced to 'rejected' so any active session also loses write access) but
// keeps the row so it can be restored. A hospital's own postings are closed
// at the same time so they drop out of the public listing.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  db.prepare(
    "UPDATE users SET deleted_at = datetime('now'), verification_status = 'rejected' WHERE id = ?"
  ).run(id);

  if (user.role === "hospital") {
    db.prepare("UPDATE jobs SET closed = 1 WHERE hospital_user_id = ? AND closed = 0").run(id);
  }

  return NextResponse.json({ ok: true });
}
