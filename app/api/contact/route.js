import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "docdocdoclink@gmail.com";

export async function POST(request) {
  const rate = checkRateLimit(`contact:${getClientIp(request)}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "送信回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const body = await request.json();
  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const role = (body.role || "").toString().trim();
  const message = (body.message || "").toString().trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "お名前・メールアドレス・お問い合わせ内容は必須です" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  const result = await sendMail({
    to: ADMIN_EMAIL,
    subject: `【DocLink】お問い合わせ（${name}様）`,
    text: `DocLinkのサイトからお問い合わせがありました。\n\nお名前: ${name}\nメールアドレス: ${email}\nご立場: ${role || "未回答"}\n\n--- お問い合わせ内容 ---\n${message}`,
    replyTo: email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "送信に失敗しました。しばらくしてから再度お試しください。" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
