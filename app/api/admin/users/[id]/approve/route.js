import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

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

  db.prepare("UPDATE users SET verification_status = 'approved' WHERE id = ?").run(id);

  await sendMail({
    to: user.email,
    subject: "【DocLink】ご登録内容の確認が完了しました",
    text: `${user.display_name} 様\n\nご登録内容の確認が完了し、アカウントが有効になりました。\n下記よりログインして、求人への応募・掲載・メッセージ機能がご利用いただけます。\n\nログイン: ${APP_URL}/login\n\n引き続きどうぞよろしくお願いいたします。`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
