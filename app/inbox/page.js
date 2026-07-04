"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "../components/Topbar";

function formatShortTime(sqliteText) {
  if (!sqliteText) return "";
  return new Date(sqliteText.replace(" ", "T") + "Z").toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (!s.loggedIn) router.push("/login");
      });
    fetch("/api/inbox")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations));
  }, [router]);

  const specialties = useMemo(
    () => [...new Set((conversations || []).map((c) => c.specialty).filter(Boolean))],
    [conversations]
  );

  const filtered = (conversations || []).filter(
    (c) => !specialtyFilter || c.specialty === specialtyFilter
  );

  if (!session?.loggedIn || conversations === null) {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <div className="loading-state">読み込み中...</div>
        </main>
      </>
    );
  }

  const isHospital = session.role === "hospital";

  return (
    <>
      <Topbar session={session} />
      <main className="wrap">
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>メッセージ一覧</h1>
        <p className="sub">
          {isHospital
            ? "あなたの求人に届いたすべての会話がここにまとまります。"
            : "あなたが問い合わせたすべての求人の会話がここにまとまります。"}
        </p>

        {isHospital && specialties.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <label className="field" style={{ maxWidth: 280, marginBottom: 0 }}>
              専門医資格で絞り込み
              <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
                <option value="">すべて</option>
                {specialties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            {conversations.length === 0 ? "まだ会話はありません。" : "条件に合う会話がありません。"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {filtered.map((c) => (
              <Link
                key={`${c.jobId}-${c.doctorUserId}`}
                href={`/jobs/${c.jobId}`}
                className="card"
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  border: c.unread > 0 ? "1.5px solid #1a56db" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{c.counterpart}</span>
                      {isHospital && c.specialty && <span className="tag tag-type">{c.specialty}</span>}
                      {c.hired && <span className="tag tag-hired">成約済み</span>}
                      {c.unread > 0 && (
                        <span
                          style={{
                            background: "#1a56db",
                            color: "#fff",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "1px 8px",
                          }}
                        >
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{c.title}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#374151",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.lastText}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{formatShortTime(c.lastAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
