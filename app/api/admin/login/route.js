import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "doclink-admin-2026";

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
  session.isAdmin = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
