"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WelcomeModal from "./WelcomeModal";

// jobSeeking/onJobSeekingChange are optional: pages that already track this
// themselves (like /jobs, which has its own banner for it) pass them down so
// both controls stay in sync. Pages that don't care just get a self-managed
// toggle instead.
export default function Topbar({ session, jobSeeking: jobSeekingProp, onJobSeekingChange }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  // Uncontrolled mode: the session's own value is the source of truth until
  // the user toggles it here (localOverride) — derived, not synced via effect.
  const [localOverride, setLocalOverride] = useState(null);
  const [jobSeekingBusy, setJobSeekingBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isControlled = jobSeekingProp !== undefined;
  const jobSeeking = isControlled
    ? jobSeekingProp
    : localOverride ?? (session?.role === "doctor" ? !!session.jobSeeking : true);

  useEffect(() => {
    if (!session?.loggedIn) return;
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((d) => setUnread(d.unreadTotal || 0))
      .catch(() => {});
  }, [session?.loggedIn]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function toggleJobSeeking() {
    setJobSeekingBusy(true);
    const next = !jobSeeking;
    const res = await fetch("/api/doctor/job-seeking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    if (res.ok) {
      if (isControlled) onJobSeekingChange?.(next);
      else setLocalOverride(next);
    }
    setJobSeekingBusy(false);
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/jobs" className="brand">
          DocLink <span className="badge">Prototype</span>
        </Link>
        {session?.loggedIn ? (
          <div className="userchip">
            {session.role === "doctor" && (
              <button
                type="button"
                onClick={toggleJobSeeking}
                disabled={jobSeekingBusy}
                title="オフの間は病院から新規にメッセージ（メール通知含む）が届かなくなります。ご自身から送るのはいつでも可能です。"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: `1px solid ${jobSeeking ? "#c7dcff" : "#e5e7eb"}`,
                  background: jobSeeking ? "#eef4ff" : "#f3f4f6",
                  color: jobSeeking ? "#1a56db" : "#6b7280",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {jobSeekingBusy ? "更新中..." : jobSeeking ? "🟢 求職中" : "⚪ 停止中"}
              </button>
            )}
            <Link href="/inbox" className="btn-outline" style={{ textDecoration: "none", position: "relative" }}>
              💬 メッセージ
              {unread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    background: "#e74c3c",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                  }}
                >
                  {unread}
                </span>
              )}
            </Link>
            <span className="role">{session.role === "hospital" ? "🏥 病院" : "🩺 医師"}</span>
            <Link href="/account" style={{ color: "inherit", textDecoration: "none" }}>
              {session.displayName} さん
            </Link>
            <button className="btn-outline" onClick={() => setShowHelp(true)}>
              ❓ 使い方
            </button>
            <button className="btn-outline" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/login" className="btn-outline" style={{ textDecoration: "none" }}>
              ログイン
            </Link>
            <Link href="/signup" className="btn-primary" style={{ textDecoration: "none" }}>
              会員登録
            </Link>
          </div>
        )}
      </div>
      {showHelp && session?.loggedIn && (
        <WelcomeModal session={session} reopened onDismiss={() => setShowHelp(false)} />
      )}
    </header>
  );
}
