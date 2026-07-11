import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(request, { params }) {
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

  db.prepare(
    `UPDATE jobs SET title = ?, type = ?, area = ?, city = ?, dept = ?, date_text = ?, work_date = ?, work_date_ongoing = ?, pay_text = ?, pay_amount = ?, desc = ?,
       emergency_volume = ?, outpatient_volume = ?, night_duty_note = ?, backup_note = ?, hospital_website = ?, access = ?,
       confirmed_at = datetime('now')
     WHERE id = ?`
  ).run(
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
    (access || "").trim() || null,
    id
  );

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return NextResponse.json({ job: updated });
}
