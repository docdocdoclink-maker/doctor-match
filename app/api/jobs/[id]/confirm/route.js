import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "hospital") {
    return NextResponse.json({ error: "病院アカウントでログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }
  if (job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
  }

  db.prepare("UPDATE jobs SET confirmed_at = datetime('now') WHERE id = ?").run(id);

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return NextResponse.json({ job: updated });
}
