import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(request) {
  const session = await getSession();
  if (!session.userId || session.role !== "doctor") {
    return NextResponse.json({ error: "医師アカウントでログインしてください" }, { status: 403 });
  }

  const { active } = await request.json();
  db.prepare("UPDATE users SET job_seeking = ? WHERE id = ?").run(active ? 1 : 0, session.userId);

  return NextResponse.json({ ok: true, jobSeeking: !!active });
}
