"use client";
import { useEffect, useState } from "react";

function formatDateTime(sqliteText) {
  if (!sqliteText) return "";
  return new Date(sqliteText.replace(" ", "T") + "Z").toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [users, setUsers] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    const res = await fetch("/api/admin/pending");
    if (res.status === 403) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users);
    setAuthed(true);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setLoginError(data.error || "ログインに失敗しました");
      return;
    }
    setPassword("");
    await loadPending();
  }

  async function handleApprove(id) {
    setBusyId(id);
    await fetch(`/api/admin/users/${id}/approve`, { method: "POST" });
    await loadPending();
    setBusyId(null);
  }

  async function handleReject(id) {
    const reason = window.prompt("却下理由（任意・本人にそのままメールで送られます）", "");
    if (reason === null) return;
    setBusyId(id);
    await fetch(`/api/admin/users/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await loadPending();
    setBusyId(null);
  }

  if (!authed) {
    return (
      <div className="wrap-narrow">
        <h1 style={{ fontSize: 18, textAlign: "center", marginBottom: 24 }}>DocLink 管理画面</h1>
        <div className="card">
          {loginError && <div className="error-box">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <label className="field">
              管理者パスワード
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="btn-primary" style={{ width: "100%" }}>
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="wrap">
      <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>審査待ちの登録</h1>
      <p className="sub">
        本人確認のため、医師については
        <a href="https://licenseif.mhlw.go.jp/search_isei/" target="_blank" rel="noreferrer" style={{ color: "#1a56db", fontWeight: 700 }}>
          {" "}
          厚生労働省 医師等資格確認検索
        </a>
        で氏名・医籍情報を照合してから承認してください。
      </p>

      {users === null ? (
        <div className="loading-state">読み込み中...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">審査待ちの登録はありません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          {users.map((u) => (
            <div key={u.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="tag tag-type">{u.role === "doctor" ? "🩺 医師" : "🏥 病院"}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{u.displayName}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{u.email}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>登録日時: {formatDateTime(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-success" disabled={busyId === u.id} onClick={() => handleApprove(u.id)}>
                    承認する
                  </button>
                  <button className="btn-outline" disabled={busyId === u.id} onClick={() => handleReject(u.id)}>
                    却下する
                  </button>
                </div>
              </div>

              {u.role === "doctor" && (
                <div style={{ borderTop: "1px solid #eee", marginTop: 12, paddingTop: 12, fontSize: 13 }}>
                  {u.licenseNumber && (
                    <div style={{ marginBottom: 4 }}>
                      <strong>医籍登録番号：</strong>
                      {u.licenseNumber}
                    </div>
                  )}
                  {u.specialty && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>専門医資格：</strong>
                      {u.specialty}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12 }}>
                    {u.documents.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/uploads/${d.stored_name}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1a56db", fontWeight: 700, fontSize: 13 }}
                      >
                        📎 {d.type === "resume" ? "履歴書" : "医師免許証"}を見る
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
