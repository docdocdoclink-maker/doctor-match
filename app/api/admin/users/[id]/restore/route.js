import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Reactivates a soft-deleted account. Does not reopen any job postings that
// were auto-closed on delete — the hospital can reopen individual listings
// themselves from the job detail page if they still want them live.
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
    "UPDATE users SET deleted_at = NULL, verification_status = 'approved' WHERE id = ?"
  ).run(id);

  return NextResponse.json({ ok: true });
}
