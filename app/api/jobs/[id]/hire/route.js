import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { getFeeForJobType, formatYen, getPaymentLinkForJobType } from "@/lib/pricing";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

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
  if (job.hired) {
    return NextResponse.json({ error: "既に成約済みです" }, { status: 409 });
  }

  const { doctorUserId } = await request.json().catch(() => ({}));
  const hiredDoctorUserId = doctorUserId ? Number(doctorUserId) : null;

  db.prepare(
    "UPDATE jobs SET hired = 1, hired_at = datetime('now', 'localtime'), hired_doctor_user_id = ? WHERE id = ?"
  ).run(hiredDoctorUserId, id);

  // Tell the hired doctor apart from everyone else who was just talking to
  // this hospital about the same posting — they get a different message
  // and a chance to confirm the hire themselves (see confirm-hire route).
  const doctorIds = db
    .prepare("SELECT doctor_user_id FROM conversations WHERE job_id = ?")
    .all(id)
    .map((r) => r.doctor_user_id);

  const insertMsg = db.prepare(
    "INSERT INTO messages (job_id, doctor_user_id, sender_user_id, sender_role, text) VALUES (?, ?, ?, 'system', ?)"
  );
  for (const conversingDoctorId of doctorIds) {
    const isHiredDoctor = hiredDoctorUserId && conversingDoctorId === hiredDoctorUserId;
    const message = isHiredDoctor
      ? "病院があなたの採用を決定したと報告しました。内容に相違なければ、下の「採用について同意する」から確認をお願いします。"
      : "この求人は成約となり、募集が終了しました。";
    insertMsg.run(id, conversingDoctorId, session.userId, message);
    const doctor = db.prepare("SELECT * FROM users WHERE id = ?").get(conversingDoctorId);
    if (doctor?.email_notify) {
      sendMail({
        to: doctor.email,
        subject: isHiredDoctor
          ? `【DocLink】${job.title} の採用が決定しました`
          : `【DocLink】${job.title} は募集終了となりました`,
        text: isHiredDoctor
          ? `${job.hospital_name}があなたの採用を決定したと報告しました。内容に相違なければ求人ページから確認をお願いします。\n\n求人ページ: ${APP_URL}/jobs/${id}`
          : `${job.hospital_name}の求人は成約となり、募集が終了しました。\n\n求人ページ: ${APP_URL}/jobs/${id}`,
      }).catch(() => {});
    }
  }

  const fee = getFeeForJobType(job.type);
  const paymentLink = getPaymentLinkForJobType(job.type);
  const hospital = db.prepare("SELECT * FROM users WHERE id = ?").get(session.userId);
  if (hospital?.email_notify) {
    sendMail({
      to: hospital.email,
      subject: `【DocLink】${job.title} 成約のお手続きありがとうございます（手数料 ${formatYen(fee)}）`,
      text: paymentLink
        ? `成約報告ありがとうございます。手数料 ${formatYen(fee)} のお支払いを以下のリンクからお願いします。\n\n${paymentLink}\n\n求人ページ: ${APP_URL}/jobs/${id}`
        : `成約報告ありがとうございます。手数料 ${formatYen(fee)} の請求書を追ってお送りします。\n\n求人ページ: ${APP_URL}/jobs/${id}`,
    }).catch(() => {});
  }

  const updated = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  return NextResponse.json({ job: updated });
}
