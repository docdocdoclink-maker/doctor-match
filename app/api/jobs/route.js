import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { getVerificationStatus, PENDING_ACTION_ERROR } from "@/lib/verification";

export async function GET() {
  const session = await getSession();
  // A hospital account has no reason to browse other hospitals' postings —
  // it only manages its own. Doctors and anonymous visitors still see the
  // full public listing, which is the whole point of the job board.
  if (session.role === "hospital" && session.userId) {
    const jobs = db
      .prepare("SELECT * FROM jobs WHERE hospital_user_id = ? ORDER BY created_at DESC")
      .all(session.userId);
    return NextResponse.json({ jobs });
  }

  // Withdrawn postings stay in the hospital's own view (above) but drop out
  // of the public/doctor-facing listing.
  const jobs = db.prepare("SELECT * FROM jobs WHERE closed = 0 ORDER BY created_at DESC").all();
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
  const {
    title,
    type,
    area,
    city,
    dept,
    dateText,
    workDate,
    workDateOngoing,
    payText,
    payAmount,
    desc,
    emergencyVolume,
    outpatientVolume,
    nightDutyNote,
    backupNote,
    hospitalWebsite,
    access,
  } = body;
  if (!title || !type || !area || !dept || !dateText || (!workDate && !workDateOngoing) || !payText || !desc) {
    return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 });
  }
  const payAmountNum = Number(payAmount);
  if (!Number.isFinite(payAmountNum) || payAmountNum < 0) {
    return NextResponse.json({ error: "報酬額（万円）は0以上の数値で入力してください" }, { status: 400 });
  }
  const website = (hospitalWebsite || "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    return NextResponse.json({ error: "病院公式サイトURLは http:// または https:// から始めてください" }, { status: 400 });
  }

  const info = db
    .prepare(
      `INSERT INTO jobs (hospital_user_id, hospital_name, title, type, area, city, dept, date_text, work_date, work_date_ongoing, pay_text, pay_amount, desc, emergency_volume, outpatient_volume, night_duty_note, backup_note, hospital_website, access, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      session.userId,
      session.displayName,
      title,
      type,
      area,
      (city || "").trim() || null,
      dept,
      dateText,
      workDateOngoing ? null : workDate,
      workDateOngoing ? 1 : 0,
      payText,
      payAmountNum,
      desc,
      (emergencyVolume || "").trim() || null,
      (outpatientVolume || "").trim() || null,
      (nightDutyNote || "").trim() || null,
      (backupNote || "").trim() || null,
      website || null,
      (access || "").trim() || null
    );

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ job });
}
