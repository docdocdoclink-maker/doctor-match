import { NextResponse } from "next/server";
import crypto from "crypto";
import db from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TOKEN_VALID_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request) {
  const rate = checkRateLimit(`forgot-password:${getClientIp(request)}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const { email } = await request.json();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email || "").trim());

  // Always respond the same way regardless of whether the address is
  // registered, so this can't be used to check who has an account.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare(
      "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?"
    ).run(token, new Date(Date.now() + TOKEN_VALID_MS).toISOString(), user.id);

    const link = `${APP_URL}/reset-password?token=${token}`;
    sendMail({
      to: user.email,
      subject: "【DocLink】パスワード再設定のご案内",
      text: `${user.display_name} 様\n\nパスワード再設定のリクエストを受け付けました。\n以下のリンクから新しいパスワードを設定してください（1時間有効です）。\n\n${link}\n\n心当たりがない場合は、このメールは破棄してください。`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
