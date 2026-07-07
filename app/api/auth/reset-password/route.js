import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request) {
  const rate = checkRateLimit(`reset-password:${getClientIp(request)}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const { token, password } = await request.json();
  if (!token || !password) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
  }

  const user = db.prepare("SELECT * FROM users WHERE reset_token = ?").get(token);
  if (!user || !user.reset_token_expires_at || new Date(user.reset_token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: "リンクの有効期限が切れています。もう一度パスワード再設定をお試しください。" },
      { status: 400 }
    );
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?"
  ).run(hash, user.id);

  return NextResponse.json({ ok: true });
}
