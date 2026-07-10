import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";
import { EMPLOYMENT_PREFERENCES } from "@/lib/jobOptions";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  const user = db
    .prepare("SELECT display_name, specialty, license_number, phone, desired_employment_type FROM users WHERE id = ?")
    .get(session.userId);
  return NextResponse.json({
    displayName: user.display_name,
    specialty: user.specialty || "",
    licenseNumber: user.license_number || "",
    phone: user.phone || "",
    desiredEmploymentType: user.desired_employment_type || "",
  });
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const body = await request.json();
  const displayName = (body.displayName || "").trim();
  if (!displayName) {
    return NextResponse.json({ error: session.role === "hospital" ? "病院名を入力してください" : "お名前を入力してください" }, { status: 400 });
  }

  if (session.role === "doctor") {
    const specialty = (body.specialty || "").trim();
    const licenseNumber = (body.licenseNumber || "").trim();
    const desiredEmploymentType = (body.desiredEmploymentType || "").trim();
    if (desiredEmploymentType && !EMPLOYMENT_PREFERENCES.includes(desiredEmploymentType)) {
      return NextResponse.json({ error: "希望する勤務形態が不正です" }, { status: 400 });
    }
    db.prepare(
      "UPDATE users SET display_name = ?, specialty = ?, license_number = ?, desired_employment_type = ? WHERE id = ?"
    ).run(displayName, specialty || null, licenseNumber || null, desiredEmploymentType || null, session.userId);
  } else {
    const phone = (body.phone || "").trim();
    if (!phone) {
      return NextResponse.json({ error: "電話番号を入力してください" }, { status: 400 });
    }
    db.prepare("UPDATE users SET display_name = ?, phone = ? WHERE id = ?").run(displayName, phone, session.userId);
  }

  session.displayName = displayName;
  await session.save();

  return NextResponse.json({ ok: true });
}
