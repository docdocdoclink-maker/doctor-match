import db from "@/lib/db";

// Always re-reads from the DB (not the session) so that an admin approving a
// user takes effect immediately, without requiring the user to log out/in.
export function getVerificationStatus(userId) {
  const row = db.prepare("SELECT verification_status FROM users WHERE id = ?").get(userId);
  return row?.verification_status || "pending";
}

export const PENDING_ACTION_ERROR =
  "アカウントの確認が完了するまで、この操作はご利用いただけません。確認が完了次第メールでお知らせします。";
