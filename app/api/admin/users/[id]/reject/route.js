import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }
  const { reason } = await request.json().catch(() => ({}));

  db.prepare("UPDATE users SET verification_status = 'rejected' WHERE id = ?").run(id);

  await sendMail({
    to: user.email,
    subject: "【DocLink】ご登録内容の確認結果について",
    text: `${user.display_name} 様\n\n誠に恐れ入りますが、ご提出いただいた内容を確認した結果、今回はご登録を承認することができませんでした。${reason ? `\n\n理由: ${reason}` : ""}\n\nご不明な点がございましたら、本メールにご返信ください。`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
