import { NextResponse } from "next/server";
import db from "@/lib/db";

// Fired once per job-detail-page load, by anyone (no auth) — backs the
// "クリック数が多い順" sort on the job list. Best-effort: a bad id just
// means nothing to increment, not an error worth surfacing to the visitor.
export async function POST(request, { params }) {
  const { id } = await params;
  db.prepare("UPDATE jobs SET click_count = click_count + 1 WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
