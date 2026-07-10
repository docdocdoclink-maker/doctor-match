import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

// Lets admin correct a hospital/doctor's own profile fields on their behalf
// (e.g. a typo'd phone number or a hospital name change reported via
// Contact) without them needing to self-serve an edit flow that doesn't
// exist yet. Role and password are deliberately not editable here.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const { id } = await params;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { displayName, email, phone, specialty, licenseNumber } = await request.json();
  const trimmedEmail = (email || "").trim();
  const trimmedName = (displayName || "").trim();
  if (!trimmedEmail || !trimmedName) {
    return NextResponse.json({ error: "名前とメールアドレスは必須です" }, { status: 400 });
  }

  const emailOwner = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(trimmedEmail, id);
  if (emailOwner) {
    return NextResponse.json({ error: "このメールアドレスは既に他のアカウントで使われています" }, { status: 409 });
  }

  db.prepare(
    `UPDATE users SET display_name = ?, email = ?, phone = ?, specialty = ?, license_number = ? WHERE id = ?`
  ).run(
    trimmedName,
    trimmedEmail,
    (phone || "").trim() || null,
    user.role === "doctor" ? (specialty || "").trim() || null : null,
    user.role === "doctor" ? (licenseNumber || "").trim() || null : null,
    id
  );

  const updated = db.prepare("SELECT id, email, role, display_name, phone, specialty, license_number FROM users WHERE id = ?").get(id);
  return NextResponse.json({ user: updated });
}
