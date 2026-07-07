import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isAdmin && (!session.userId || session.role !== "hospital")) {
    return NextResponse.json({ error: "病院アカウントでログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }
  // Admin can close any listing (e.g. a hospital that's gone unreachable);
  // a hospital account can only touch its own.
  if (!session.isAdmin && job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
  }

  const { closed } = await request.json();
  db.prepare("UPDATE jobs SET closed = ? WHERE id = ?").run(closed ? 1 : 0, id);

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return NextResponse.json({ job: updated });
}
