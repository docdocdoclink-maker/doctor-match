import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sendMail } from "@/lib/mailer";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "doclink-admin-2026";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const OTP_VALID_MS = 10 * 60 * 1000;

export async function POST(request) {
  const rate = checkRateLimit(`admin-login:${getClientIp(request)}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const { password } = await request.json();
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const session = await getSession();

  // Password alone doesn't grant access — a one-time code sent to the
  // admin's own email is required too, so a leaked password isn't enough.
  // (Skipped only if ADMIN_EMAIL isn't configured, e.g. local dev.)
  if (!ADMIN_EMAIL) {
    session.isAdmin = true;
    await session.save();
    return NextResponse.json({ ok: true });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  session.isAdmin = false;
  session.adminOtpCode = code;
  session.adminOtpExpiresAt = Date.now() + OTP_VALID_MS;
  await session.save();

  // Fire-and-forget: don't make the login response wait on SMTP, which can
  // be slow enough (or hang outright) to make the login button look broken.
  sendMail({
    to: ADMIN_EMAIL,
    subject: "【DocLink】管理画面ログインの確認コード",
    text: `管理画面へのログインリクエストがありました。\n\n確認コード: ${code}\n\n（10分間有効です。心当たりがない場合はこのメールを無視してください。）`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, otpRequired: true });
}
