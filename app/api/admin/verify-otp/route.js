import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request) {
  const rate = checkRateLimit(`admin-otp:${getClientIp(request)}`, { max: 8, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const { code } = await request.json();
  const session = await getSession();

  if (!session.adminOtpCode || !session.adminOtpExpiresAt) {
    return NextResponse.json({ error: "先にパスワードでログインしてください" }, { status: 400 });
  }
  if (Date.now() > session.adminOtpExpiresAt) {
    session.adminOtpCode = undefined;
    session.adminOtpExpiresAt = undefined;
    await session.save();
    return NextResponse.json({ error: "確認コードの有効期限が切れました。もう一度ログインしてください。" }, { status: 401 });
  }
  if (code !== session.adminOtpCode) {
    return NextResponse.json({ error: "確認コードが違います" }, { status: 401 });
  }

  session.isAdmin = true;
  session.adminOtpCode = undefined;
  session.adminOtpExpiresAt = undefined;
  await session.save();
  return NextResponse.json({ ok: true });
}
