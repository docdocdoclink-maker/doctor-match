import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getFeeForJobType, formatYen, getPaymentLinkForJobType, isFreeCampaignActive } from "@/lib/pricing";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Hire state lives per (job_id, doctor_user_id) conversation, not per job —
// a job can have several independent hires (e.g. filling more than one
// shift from the same posting), each billed separately. Hiring doesn't
// touch jobs.closed at all; the listing only closes when the hospital
// closes it manually (see the close route).
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.userId || (session.role !== "hospital" && session.role !== "doctor")) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 403 });
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!job) {
    return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
  }

  let doctorUserId;
  if (session.role === "hospital") {
    if (job.hospital_user_id !== session.userId) {
      return NextResponse.json({ error: "この求人を編集する権限がありません" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    doctorUserId = Number(body.doctorUserId);
    if (!doctorUserId) {
      return NextResponse.json({ error: "採用する医師を選択してください" }, { status: 400 });
    }
  } else {
    doctorUserId = session.userId;
  }

  const conv = db
    .prepare("SELECT * FROM conversations WHERE job_id = ? AND doctor_user_id = ?")
    .get(id, doctorUserId);
  if (!conv) {
    return NextResponse.json({ error: "この医師との会話が見つかりません" }, { status: 403 });
  }
  if (conv.hired) {
    return NextResponse.json({ error: "この医師については既に採用報告済みです" }, { status: 409 });
  }

  db.prepare(
    "UPDATE conversations SET hired = 1, hired_at = datetime('now', 'localtime'), hired_reported_by = ? WHERE job_id = ? AND doctor_user_id = ?"
  ).run(session.role, id, doctorUserId);

  // A hospital's own report is final immediately — no confirmation ask.
  // Only a doctor's self-report still needs the hospital to confirm
  // (billing depends on the hospital's own action, so a false doctor
  // report can't put a hospital on the hook — see confirm-hire route).
  const message =
    session.role === "hospital"
      ? "病院があなたの採用を決定しました。"
      : "採用の報告をしました。病院からの確認をお待ちください（下の「採用について確認する」から病院が確認します）。";
  db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  ).run(id, doctorUserId, session.userId, message);

  const doctor = db.prepare("SELECT * FROM users WHERE id = ?").get(doctorUserId);
  if (doctor?.email_notify && doctorUserId !== session.userId) {
    sendMail({
      to: doctor.email,
      subject: `【DocLink】${job.title} の採用が決定しました`,
      text: `${job.hospital_name}があなたの採用を決定しました。\n\n求人ページ: ${APP_URL}/jobs/${id}`,
    }).catch(() => {});
  }

  const fee = getFeeForJobType(job.type);
  const paymentLink = getPaymentLinkForJobType(job.type);
  const freeCampaign = isFreeCampaignActive();
  const hospital = db.prepare("SELECT * FROM users WHERE id = ?").get(job.hospital_user_id);
  if (hospital?.email_notify) {
    const reportedByDoctor = session.role === "doctor";
    sendMail({
      to: hospital.email,
      subject: reportedByDoctor
        ? `【DocLink】${job.title} で医師から成約報告がありました（要確認）`
        : freeCampaign
          ? `【DocLink】${job.title} 成約のお手続きありがとうございます（キャンペーン中につき手数料無料）`
          : `【DocLink】${job.title} 成約のお手続きありがとうございます（手数料 ${formatYen(fee)}）`,
      text: reportedByDoctor
        ? `医師が「採用された」と報告しました。内容に相違なければ求人ページの「採用について確認する」からご確認ください。\n\n求人ページ: ${APP_URL}/jobs/${id}`
        : freeCampaign
          ? `成約報告ありがとうございます。今年度中はキャンペーンにより手数料は無料です。お支払いは不要です。\n\n求人ページ: ${APP_URL}/jobs/${id}`
          : paymentLink
            ? `成約報告ありがとうございます。手数料 ${formatYen(fee)} のお支払いを以下のリンクからお願いします。\n\n${paymentLink}\n\n求人ページ: ${APP_URL}/jobs/${id}`
            : `成約報告ありがとうございます。手数料 ${formatYen(fee)} の請求書を追ってお送りします。\n\n求人ページ: ${APP_URL}/jobs/${id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
