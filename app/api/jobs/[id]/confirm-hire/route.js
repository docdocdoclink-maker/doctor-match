import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getFeeForJobType, formatYen, getPaymentLinkForJobType, isFreeCampaignActive } from "@/lib/pricing";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// A hospital's own hire report is final the moment it's made — no
// confirmation needed from the doctor, since the hospital is the one who
// pays the fee either way (see the hire route). A doctor's self-report is
// different: only the hospital confirming it here (its own affirmative
// action) starts billing, so a false doctor report can't put a hospital on
// the hook for a fee it never agreed to. Scoped to one (job, doctor)
// conversation, since a job can have several independent hires.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || session.role !== "hospital") {
    return NextResponse.json({ error: "病院アカウントでログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job || job.hospital_user_id !== session.userId) {
    return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const doctorUserId = Number(body.doctorUserId);
  if (!doctorUserId) {
    return NextResponse.json({ error: "確認する医師を選択してください" }, { status: 400 });
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorUserId);
  if (!conv || !conv.hired || conv.hired_reported_by !== "doctor") {
    return NextResponse.json({ error: "確認できる採用報告がありません" }, { status: 403 });
  }
  if (conv.hire_confirmed_by_hospital_at) {
    return NextResponse.json({ error: "既に確認済みです" }, { status: 409 });
  }

  db.prepare(
    "UPDATE conversations SET hire_confirmed_by_hospital_at = datetime('now') WHERE job_id = ? AND doctor_user_id = ?"
  ).run(id, doctorUserId);

  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(id, doctorUserId, session.userId, "病院が採用について確認したことを記録しました。");

  // The hospital confirming a doctor-reported hire is the hospital's own
  // affirmative action — this is when billing kicks in for that path (see
  // the note above and the hire route, which skips the invoice at report
  // time for doctor-initiated reports).
  const fee = getFeeForJobType(job.type);
  const paymentLink = getPaymentLinkForJobType(job.type);
  const freeCampaign = isFreeCampaignActive();
  const hospital = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);
  if (hospital?.email_notify) {
    sendMail({
      to: hospital.email,
      subject: freeCampaign
        ? `【DocLink】${job.title} 成約のお手続きありがとうございます（キャンペーン中につき手数料無料）`
        : `【DocLink】${job.title} 成約のお手続きありがとうございます（手数料 ${formatYen(fee)}）`,
      text: freeCampaign
        ? `成約確認ありがとうございます。今年度中はキャンペーンにより手数料は無料です。お支払いは不要です。\n\n求人ページ: ${APP_URL}/jobs/${id}`
        : paymentLink
          ? `成約確認ありがとうございます。手数料 ${formatYen(fee)} のお支払いを以下のリンクからお願いします。\n\n${paymentLink}\n\n求人ページ: ${APP_URL}/jobs/${id}`
          : `成約確認ありがとうございます。手数料 ${formatYen(fee)} の請求書を追ってお送りします。\n\n求人ページ: ${APP_URL}/jobs/${id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
