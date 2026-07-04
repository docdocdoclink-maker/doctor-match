import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(request) {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const doctorId = url.searchParams.get("doctorId");
  if (!jobId || !doctorId) {
    return NextResponse.json({ error: "jobId, doctorId が必要です" }, { status: 400 });
  }

  const messages = db
    .prepare("SELECT * FROM messages WHERE job_id = ? AND doctor_user_id = ? ORDER BY created_at ASC")
    .all(jobId, doctorId);

  return NextResponse.json({ messages });
}
