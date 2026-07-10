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

  // The original address may have been claimed by a new signup while this
  // account was deleted — email is UNIQUE, so restoring into that would
  // collide. Surface it instead of silently failing.
  if (user.original_email) {
    const conflict = db
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .get(user.original_email, id);
    if (conflict) {
      return NextResponse.json(
        { error: `${user.original_email} は既に別のアカウントで使われているため復元できません。` },
        { status: 409 }
      );
    }
  }

  db.prepare(
    `UPDATE users
     SET deleted_at = NULL, verification_status = 'approved',
         email = COALESCE(original_email, email), original_email = NULL
     WHERE id = ?`
  ).run(id);

  return NextResponse.json({ ok: true });
}
