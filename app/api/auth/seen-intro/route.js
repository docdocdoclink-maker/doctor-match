import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  db.prepare("UPDATE users SET has_seen_intro = 1 WHERE id = ?").run(session.userId);
  return NextResponse.json({ ok: true });
}
