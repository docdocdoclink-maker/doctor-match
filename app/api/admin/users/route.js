import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mailer";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TOKEN_VALID_MS = 60 * 60 * 1000;

export async function GET() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const users = db
    .prepare(
      `SELECT id, email, original_email, role, display_name, license_number, specialty, phone, created_at, verification_status, email_notify, deleted_at
       FROM users ORDER BY created_at DESC`
    )
    .all();

  const docsStmt = db.prepare("SELECT id, type, original_name, stored_name FROM documents WHERE user_id = ?");
  const result = users.map((u) => ({
    id: u.id,
    // Deleted accounts have their real address parked in original_email (see
    // the delete route) so it can be freed up for a fresh signup — show that
    // instead of the mangled placeholder left in `email`.
    email: u.deleted_at && u.original_email ? u.original_email : u.email,
    role: u.role,
    displayName: u.display_name,
    licenseNumber: u.license_number,
    specialty: u.specialty,
    phone: u.phone,
    createdAt: u.created_at,
    verificationStatus: u.verification_status,
    emailNotify: !!u.email_notify,
    deletedAt: u.deleted_at,
    documents: u.role === "doctor" ? docsStmt.all(u.id) : [],
  }));

  return NextResponse.json({ users: result });
}

// Admin-created accounts skip the usual document-upload signup flow (the
// admin is vouching for them directly, e.g. after a phone call), so they're
// approved immediately. No password is set here — a random one is
// discarded, and the same reset-password link used for "forgot password"
// is emailed so the account holder picks their own.
export async function POST(request) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { role, displayName, email, phone } = await request.json();
  if (!role || !["doctor", "hospital"].includes(role) || !displayName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "必須項目を入力してください" }, { status: 400 });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim());
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
  }

  const randomPassword = crypto.randomBytes(24).toString("hex");
  const hash = bcrypt.hashSync(randomPassword, 10);
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + TOKEN_VALID_MS).toISOString();

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, display_name, phone, verification_status, reset_token, reset_token_expires_at)
       VALUES (?, ?, ?, ?, ?, 'approved', ?, ?)`
    )
    .run(email.trim(), hash, role, displayName.trim(), phone?.trim() || null, resetToken, resetExpires);

  const link = `${APP_URL}/reset-password?token=${resetToken}`;
  sendMail({
    to: email.trim(),
    subject: "【DocLink】アカウントが作成されました",
    text: `${displayName.trim()} 様\n\nDocLink運営により、${role === "doctor" ? "医師" : "病院"}アカウントが作成されました。\n以下のリンクからパスワードを設定して、ログインしてください（1時間有効です）。\n\n${link}`,
  }).catch(() => {});

  const user = db.prepare("SELECT id, email, role, display_name FROM users WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ user });
}
