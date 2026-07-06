"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Topbar({ session }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

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

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/jobs" className="brand">
          DocLink <span className="badge">Prototype</span>
        </Link>
        {session?.loggedIn ? (
          <div className="userchip">
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
    </header>
  );
}
