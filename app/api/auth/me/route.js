import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ loggedIn: false });
  }
  const user = db
    .prepare("SELECT has_seen_intro, verification_status, job_seeking FROM users WHERE id = ?")
    .get(session.userId);
  return NextResponse.json({
    loggedIn: true,
    userId: session.userId,
    role: session.role,
    displayName: session.displayName,
    hasSeenIntro: !!user?.has_seen_intro,
    verificationStatus: user?.verification_status || "pending",
    jobSeeking: !!user?.job_seeking,
  });
}
