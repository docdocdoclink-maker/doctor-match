import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request) {
  const { email, password } = await request.json();

  const rate = checkRateLimit(`login:${getClientIp(request)}:${email}`, { max: 10, windowMs: 15 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが違います" }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role;
  session.displayName = user.display_name;
  await session.save();

  return NextResponse.json({ ok: true, role: user.role });
}
