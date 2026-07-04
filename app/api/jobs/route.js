import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

export async function GET() {
  const jobs = db.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
  return NextResponse.json({ jobs });
}

export async function POST(request) {
  const session = await getSession();
  if (!session.userId || session.role !== "hospital") {
    return NextResponse.json({ error: "病院アカウントでログインしてください" }, { status: 403 });
  }
  if (getVerificationStatus(session.userId) !== "approved") {
    return NextResponse.json({ error: PENDING_ACTION_ERROR }, { status: 403 });
  }

  const body = await request.json();
  const { title, type, area, dept, dateText, payText, desc, emergencyVolume, nightDutyNote, backupNote, hospitalWebsite } = body;
  if (!title || !type || !area || !dept || !dateText || !payText || !desc) {
    return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 });
  }
  const website = (hospitalWebsite || "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    return NextResponse.json({ error: "病院公式サイトURLは http:// または https:// から始めてください" }, { status: 400 });
  }

  const info = db
    .prepare(
      `INSERT INTO jobs (hospital_user_id, hospital_name, title, type, area, dept, date_text, pay_text, desc, emergency_volume, night_duty_note, backup_note, hospital_website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.userId,
      session.displayName,
      title,
      type,
      area,
      dept,
      dateText,
      payText,
      desc,
      (emergencyVolume || "").trim() || null,
      (nightDutyNote || "").trim() || null,
      (backupNote || "").trim() || null,
      website || null
    );

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ job });
}
