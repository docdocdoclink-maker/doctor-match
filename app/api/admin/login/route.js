import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "doclink-admin-2026";

export async function POST(request) {
  const { password } = await request.json();
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  const session = await getSession();
  session.isAdmin = true;
  await session.save();
  return NextResponse.json({ ok: true });
}
