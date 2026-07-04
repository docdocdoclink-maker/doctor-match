import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ documents: [] });
  }
  const documents = db
    .prepare("SELECT id, type, original_name, stored_name, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC")
    .all(session.userId);
  return NextResponse.json({ documents });
}
