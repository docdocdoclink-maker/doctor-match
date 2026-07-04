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

const STATUS_LABEL = {
  pending: "審査待ち",
  approved: "承認済み",
  rejected: "却下済み",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    fetch("/api/admin/pending").then((res) => setAuthed(res.status !== 403));
  }, []);

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
    setAuthed(true);
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
      <h1 style={{ fontSize: 20, margin: "0 0 16px" }}>DocLink 管理画面</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid #eee" }}>
        {[
          { key: "pending", label: "審査待ち" },
          { key: "users", label: "全登録者" },
          { key: "chats", label: "チャット一覧" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "none",
              background: "none",
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "#1a56db" : "#6b7280",
              borderBottom: tab === t.key ? "2px solid #1a56db" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pending" && <PendingTab />}
      {tab === "users" && <UsersTab />}
      {tab === "chats" && <ChatsTab />}
    </main>
  );
}

function PendingTab() {
  const [users, setUsers] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/pending");
    const data = await res.json();
    setUsers(data.users);
  }

  async function handleApprove(id) {
    setBusyId(id);
    await fetch(`/api/admin/users/${id}/approve`, { method: "POST" });
    await load();
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
    await load();
    setBusyId(null);
  }

  return (
    <>
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
    </>
  );
}

function UsersTab() {
  const [users, setUsers] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users));
  }, []);

  const filtered = (users || []).filter((u) => !roleFilter || u.role === roleFilter);

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">すべて</option>
          <option value="doctor">医師のみ</option>
          <option value="hospital">病院のみ</option>
        </select>
      </div>

      {users === null ? (
        <div className="loading-state">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">登録者がいません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((u) => (
            <div key={u.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="tag tag-type">{u.role === "doctor" ? "🩺 医師" : "🏥 病院"}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{u.displayName}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: u.verificationStatus === "approved" ? "#0a7d3c" : u.verificationStatus === "rejected" ? "#c0392b" : "#7a5b00",
                        background: u.verificationStatus === "approved" ? "#e7f7ee" : u.verificationStatus === "rejected" ? "#fdeceb" : "#fff8e6",
                      }}
                    >
                      {STATUS_LABEL[u.verificationStatus] || u.verificationStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{u.email}</div>
                  {u.specialty && <div style={{ fontSize: 12, color: "#6b7280" }}>専門医資格: {u.specialty}</div>}
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>登録日時: {formatDateTime(u.createdAt)}</div>
                </div>
                {u.role === "doctor" && u.documents.length > 0 && (
                  <div style={{ display: "flex", gap: 10 }}>
                    {u.documents.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/uploads/${d.stored_name}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#1a56db", fontWeight: 700, fontSize: 12 }}
                      >
                        📎 {d.type === "resume" ? "履歴書" : "医師免許証"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ChatsTab() {
  const [conversations, setConversations] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    fetch("/api/admin/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations));
  }, []);

  async function openConversation(conv) {
    setActive(conv);
    setMessages(null);
    const url = new URL("/api/admin/conversations/messages", window.location.origin);
    url.searchParams.set("jobId", conv.jobId);
    url.searchParams.set("doctorId", conv.doctorUserId);
    const res = await fetch(url);
    const data = await res.json();
    setMessages(data.messages);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, alignItems: "start" }}>
      <div>
        {conversations === null ? (
          <div className="loading-state">読み込み中...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">チャットがありません。</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map((c) => (
              <button
                key={`${c.jobId}-${c.doctorUserId}`}
                onClick={() => openConversation(c)}
                className="card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  padding: 12,
                  border: active?.jobId === c.jobId && active?.doctorUserId === c.doctorUserId ? "2px solid #1a56db" : undefined,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.jobTitle}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {c.hospitalName} ⇄ {c.anonymous ? "匿名の医師" : c.doctorName}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {c.messageCount}件 ・ 最終: {formatDateTime(c.lastMessageAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ minHeight: 200 }}>
        {!active ? (
          <div className="empty-state">左の一覧からチャットを選んでください。</div>
        ) : messages === null ? (
          <div className="loading-state">読み込み中...</div>
        ) : (
          <>
            <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>
              {active.jobTitle}（{active.hospitalName} ⇄ {active.anonymous ? "匿名の医師" : active.doctorName}）
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: m.sender_role === "system" ? "#f3f4f6" : m.sender_role === "doctor" ? "#eef4ff" : "#f0fbf4",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>
                    {m.sender_role === "system" ? "システム" : m.sender_role === "doctor" ? "医師" : "病院"} ・ {formatDateTime(m.created_at)}
                  </div>
                  {m.text}
                  {m.attachment_path && (
                    <div style={{ marginTop: 4 }}>
                      <a href={`/api/uploads/${m.attachment_path}`} target="_blank" rel="noreferrer" style={{ color: "#1a56db" }}>
                        📎 {m.attachment_name}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
