import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveUpload, RESUME_ALLOWED_EXT } from "@/lib/uploads";
import { sendMail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "docdocdoclink@gmail.com";

export async function POST(request) {
  const rate = checkRateLimit(`signup:${getClientIp(request)}`, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "登録試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const form = await request.formData();
  const email = (form.get("email") || "").toString().trim();
  const password = (form.get("password") || "").toString();
  const role = (form.get("role") || "").toString();
  const displayName = (form.get("displayName") || "").toString().trim();
  const licenseNumber = (form.get("licenseNumber") || "").toString().trim();
  const specialty = (form.get("specialty") || "").toString().trim();
  const phone = (form.get("phone") || "").toString().trim();
  const agreeToTerms = form.get("agreeToTerms") === "true";
  const resumeFile = form.get("resumeFile");
  const licenseFile = form.get("licenseFile");

  if (!email || !password || !role || !displayName) {
    return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 });
  }
  if (!["doctor", "hospital"].includes(role)) {
    return NextResponse.json({ error: "不正な役割です" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 });
  }
  if (!agreeToTerms) {
    return NextResponse.json({ error: "利用規約への同意が必要です" }, { status: 400 });
  }
  if (role === "doctor") {
    const hasResume = resumeFile && typeof resumeFile === "object" && resumeFile.size > 0;
    const hasLicense = licenseFile && typeof licenseFile === "object" && licenseFile.size > 0;
    if (!hasResume || !hasLicense) {
      return NextResponse.json(
        { error: "医師登録には履歴書と医師免許証のコピーの両方が必要です" },
        { status: 400 }
      );
    }
  }
  if (role === "hospital" && !phone) {
    return NextResponse.json({ error: "病院登録には電話番号が必要です" }, { status: 400 });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
  }

  let resumeUpload = null;
  let licenseUpload = null;
  if (role === "doctor") {
    try {
      resumeUpload = await saveUpload(resumeFile, RESUME_ALLOWED_EXT);
      licenseUpload = await saveUpload(licenseFile);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, display_name, license_number, specialty, phone, agreed_to_terms_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      email,
      hash,
      role,
      displayName,
      role === "doctor" ? licenseNumber || null : null,
      role === "doctor" ? specialty || null : null,
      phone || null
    );

  const userId = info.lastInsertRowid;

  if (role === "doctor") {
    const insertDoc = db.prepare(
      "INSERT INTO documents (user_id, type, original_name, stored_name) VALUES (?, ?, ?, ?)"
    );
    insertDoc.run(userId, "resume", resumeUpload.originalName, resumeUpload.storedName);
    insertDoc.run(userId, "license", licenseUpload.originalName, licenseUpload.storedName);
  }

  const session = await getSession();
  session.userId = userId;
  session.role = role;
  session.displayName = displayName;
  await session.save();

  sendMail({
    to: ADMIN_EMAIL,
    subject: `【DocLink管理】新規登録の確認をお願いします（${role === "doctor" ? "医師" : "病院"}）`,
    text: `新規登録がありました。内容を確認し、管理画面から承認・却下をお願いします。\n\n名前: ${displayName}\nメール: ${email}${phone ? `\n電話番号: ${phone}` : ""}\n役割: ${role === "doctor" ? "医師" : "病院"}\n\n管理画面: ${APP_URL}/admin`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, role });
}
