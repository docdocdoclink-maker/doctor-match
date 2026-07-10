import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// weekdays/skills are stored as comma-separated text (SQLite has no array
// column); the API deals in arrays so callers don't have to know that.
function toApi(alert) {
  return {
    ...alert,
    weekdays: alert.weekdays ? alert.weekdays.split(",").filter(Boolean) : [],
    skills: alert.skills ? alert.skills.split(",").filter(Boolean) : [],
  };
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ alert: null });
  }
  const alert = db.prepare("SELECT * FROM alerts WHERE user_id = ?").get(session.userId);
  return NextResponse.json({
    alert: toApi(alert || { active: 0, area: "", type: "", dept: "", note: "", shift_type: "", weekdays: "", skills: "" }),
  });
}

export async function POST(request) {
  const session = await getSession();
  if (!session.userId || session.role !== "doctor") {
    return NextResponse.json({ error: "医師アカウントでログインしてください" }, { status: 403 });
  }

  const { active, area, type, dept, note, shiftType, weekdays, skills } = await request.json();

  db.prepare(
    `INSERT INTO alerts (user_id, active, area, type, dept, note, shift_type, weekdays, skills)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       active=excluded.active, area=excluded.area, type=excluded.type, dept=excluded.dept, note=excluded.note,
       shift_type=excluded.shift_type, weekdays=excluded.weekdays, skills=excluded.skills`
  ).run(
    session.userId,
    active ? 1 : 0,
    area || "",
    type || "",
    dept || "",
    note || "",
    shiftType || "",
    Array.isArray(weekdays) ? weekdays.join(",") : "",
    Array.isArray(skills) ? skills.join(",") : ""
  );

  const alert = db.prepare("SELECT * FROM alerts WHERE user_id = ?").get(session.userId);
  return NextResponse.json({ alert: toApi(alert) });
}
