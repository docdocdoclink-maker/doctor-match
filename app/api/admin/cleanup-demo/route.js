import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const demoUser = db.prepare("SELECT id FROM users WHERE email = ?").get("demo-hospital@example.com");
  if (!demoUser) {
    return NextResponse.json({ deletedJobs: 0, deletedUser: false, message: "デモ病院アカウントは見つかりませんでした（既に削除済みの可能性があります）。" });
  }

  const result = db.transaction(() => {
    const jobs = db.prepare("SELECT id FROM jobs WHERE hospital_user_id = ?").all(demoUser.id);
    const jobIds = jobs.map((j) => j.id);

    for (const jobId of jobIds) {
      db.prepare("DELETE FROM messages WHERE job_id = ?").run(jobId);
      db.prepare("DELETE FROM conversations WHERE job_id = ?").run(jobId);
    }
    db.prepare("DELETE FROM jobs WHERE hospital_user_id = ?").run(demoUser.id);
    db.prepare("DELETE FROM alerts WHERE user_id = ?").run(demoUser.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(demoUser.id);

    return jobIds.length;
  })();

  return NextResponse.json({ deletedJobs: result, deletedUser: true, message: `デモ求人 ${result} 件とデモ病院アカウントを削除しました。` });
}
