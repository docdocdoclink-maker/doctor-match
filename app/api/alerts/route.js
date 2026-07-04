import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ alert: null });
  }
  const alert = db.prepare("SELECT * FROM alerts WHERE user_id = ?").get(session.userId);
  return NextResponse.json({ alert: alert || { active: 0, area: "", type: "", dept: "" } });
}

export async function POST(request) {
  const session = await getSession();
  if (!session.userId || session.role !== "doctor") {
    return NextResponse.json({ error: "医師アカウントでログインしてください" }, { status: 403 });
  }

  const { active, area, type, dept } = await request.json();

  db.prepare(
    `INSERT INTO alerts (user_id, active, area, type, dept) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET active=excluded.active, area=excluded.area, type=excluded.type, dept=excluded.dept`
  ).run(session.userId, active ? 1 : 0, area || "", type || "", dept || "");

  const alert = db.prepare("SELECT * FROM alerts WHERE user_id = ?").get(session.userId);
  return NextResponse.json({ alert });
}
