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
  const [step, setStep] = useState("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    fetch("/api/admin/pending").then((res) => setAuthed(res.status !== 403));
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "ログインに失敗しました");
        return;
      }
      setPassword("");
      if (data.otpRequired) {
        setStep("otp");
      } else {
        setAuthed(true);
      }
    } catch (err) {
      setLoginError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setLoginError("");
    setOtpBusy(true);
    try {
      const res = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "確認に失敗しました");
        return;
      }
      setOtp("");
      setAuthed(true);
    } catch (err) {
      setLoginError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setOtpBusy(false);
    }
  }

  if (!authed && step === "otp") {
    return (
      <div className="wrap-narrow">
        <h1 style={{ fontSize: 18, textAlign: "center", marginBottom: 24 }}>DocLink 管理画面</h1>
        <div className="card">
          <p className="fee-note" style={{ marginTop: 0 }}>
            運営者のメールアドレスに6桁の確認コードを送信しました。10分以内に入力してください。
          </p>
          {loginError && <div className="error-box">{loginError}</div>}
          <form onSubmit={handleVerifyOtp}>
            <label className="field">
              確認コード
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={otpBusy}>
              {otpBusy ? "確認中..." : "確認する"}
            </button>
          </form>
        </div>
      </div>
    );
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
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loginBusy}>
              {loginBusy ? "ログイン中..." : "ログイン"}
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
          { key: "jobs", label: "求人一覧" },
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
      {tab === "jobs" && <JobsTab />}
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
        で氏名・医籍情報を照合してから承認してください。病院については
        <a
          href="https://www.iryou.teikyouseido.mhlw.go.jp/znk-web/juminkanja/S2340/initialize"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#1a56db", fontWeight: 700 }}
        >
          {" "}
          医療情報ネット
        </a>
        で病院の実在を確認し、可能であれば電話番号にかけて登録意思を確認してから承認してください。
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
                  {u.phone && <div style={{ fontSize: 13, color: "#6b7280" }}>電話番号: {u.phone}</div>}
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>登録日時: {formatDateTime(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-success" disabled={busyId === u.id} onClick={() => handleApprove(u.id)}>
                    {busyId === u.id ? "処理中..." : "承認する"}
                  </button>
                  <button className="btn-outline" disabled={busyId === u.id} onClick={() => handleReject(u.id)}>
                    {busyId === u.id ? "処理中..." : "却下する"}
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
  const [showDeleted, setShowDeleted] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  function loadUsers() {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users));
  }

  const filtered = (users || []).filter(
    (u) => (!roleFilter || u.role === roleFilter) && (showDeleted || !u.deletedAt)
  );
  const hasDemoHospital = (users || []).some((u) => u.email === "demo-hospital@example.com");

  async function handleCleanupDemo() {
    if (!window.confirm("デモ病院アカウントと、そこに紐づくデモ求人をすべて削除します。よろしいですか？")) return;
    setCleaning(true);
    setCleanupMessage("");
    const res = await fetch("/api/admin/cleanup-demo", { method: "POST" });
    const data = await res.json();
    setCleanupMessage(data.message || "");
    setCleaning(false);
    loadUsers();
  }

  async function handleDelete(u) {
    if (!window.confirm(`${u.displayName}（${u.email}）を削除します。よろしいですか？（後から復元できます）`)) return;
    setBusyId(u.id);
    await fetch(`/api/admin/users/${u.id}/delete`, { method: "POST" });
    await loadUsers();
    setBusyId(null);
  }

  async function handleRestore(u) {
    setBusyId(u.id);
    await fetch(`/api/admin/users/${u.id}/restore`, { method: "POST" });
    await loadUsers();
    setBusyId(null);
  }

  return (
    <>
      {hasDemoHospital && (
        <div className="card" style={{ marginBottom: 14, padding: 14, background: "#fff8e6" }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            デモ病院アカウント（demo-hospital@example.com）とデモ求人がまだ残っています。公開前に削除しておきましょう。
          </div>
          <button className="btn-outline" disabled={cleaning} onClick={handleCleanupDemo}>
            {cleaning ? "削除中..." : "デモデータを削除する"}
          </button>
          {cleanupMessage && <div style={{ fontSize: 12, color: "#0a7d3c", marginTop: 8 }}>{cleanupMessage}</div>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        {!showCreate ? (
          <button className="btn-outline" onClick={() => setShowCreate(true)}>
            ＋ アカウントを手動作成する
          </button>
        ) : (
          <CreateUserForm
            onDone={() => {
              setShowCreate(false);
              loadUsers();
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">すべて</option>
          <option value="doctor">医師のみ</option>
          <option value="hospital">病院のみ</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4b5563" }}>
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          削除済みアカウントも表示
        </label>
      </div>

      {users === null ? (
        <div className="loading-state">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">登録者がいません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((u) => (
            <div key={u.id} className="card" style={{ padding: 14, opacity: u.deletedAt ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="tag tag-type">{u.role === "doctor" ? "🩺 医師" : "🏥 病院"}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{u.displayName}</span>
                    {u.deletedAt ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          color: "#c0392b",
                          background: "#fdeceb",
                        }}
                      >
                        削除済み（{formatDateTime(u.deletedAt)}）
                      </span>
                    ) : (
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
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{u.email}</div>
                  {u.phone && <div style={{ fontSize: 13, color: "#6b7280" }}>電話番号: {u.phone}</div>}
                  {u.specialty && <div style={{ fontSize: 12, color: "#6b7280" }}>専門医資格: {u.specialty}</div>}
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>登録日時: {formatDateTime(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  {u.deletedAt ? (
                    <button className="btn-outline" style={{ fontSize: 12 }} disabled={busyId === u.id} onClick={() => handleRestore(u)}>
                      {busyId === u.id ? "処理中..." : "復元する"}
                    </button>
                  ) : (
                    <button className="btn-outline" style={{ fontSize: 12 }} disabled={busyId === u.id} onClick={() => handleDelete(u)}>
                      {busyId === u.id ? "処理中..." : "削除する"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CreateUserForm({ onDone, onCancel }) {
  const [role, setRole] = useState("doctor");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, displayName, email, phone }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "作成に失敗しました");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="fee-note" style={{ marginTop: 0 }}>
        承認済みの状態で作成され、パスワード設定用のリンクが本人にメールで送信されます。
      </p>
      {error && <div className="error-box">{error}</div>}
      <div className="role-toggle" style={{ marginBottom: 12 }}>
        <button type="button" className={role === "doctor" ? "active" : ""} onClick={() => setRole("doctor")}>
          🩺 医師
        </button>
        <button type="button" className={role === "hospital" ? "active" : ""} onClick={() => setRole("hospital")}>
          🏥 病院
        </button>
      </div>
      <label className="field">
        {role === "hospital" ? "病院名" : "お名前"}
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label className="field">
        メールアドレス
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {role === "hospital" && (
        <label className="field">
          電話番号
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "作成中..." : "作成する"}
        </button>
        <button type="button" className="btn-outline" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}

function JobsTab() {
  const [jobs, setJobs] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadJobs();
  }, []);

  function loadJobs() {
    fetch("/api/admin/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs));
  }

  const filtered = (jobs || []).filter((j) => {
    if (statusFilter === "open") return !j.closed;
    if (statusFilter === "closed") return j.closed;
    if (statusFilter === "hired") return j.hired;
    return true;
  });

  async function handleToggleClosed(job) {
    if (!job.closed && !window.confirm(`「${job.title}」（${job.hospitalName}）を非公開にします。よろしいですか？`)) return;
    setBusyId(job.id);
    await fetch(`/api/jobs/${job.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: !job.closed }),
    });
    await loadJobs();
    setBusyId(null);
  }

  return (
    <>
      <p className="fee-note" style={{ marginTop: 0 }}>
        病院と連絡が取れない等の事情で、運営側から求人を非公開にできます。病院アカウント自体はそのまま残ります。
      </p>
      <div style={{ marginBottom: 14 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">すべて</option>
          <option value="open">掲載中のみ</option>
          <option value="closed">非公開のみ</option>
          <option value="hired">成約済みのみ</option>
        </select>
      </div>

      {jobs === null ? (
        <div className="loading-state">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">求人がありません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((j) => (
            <div key={j.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span className="tag tag-type">{j.type}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{j.title}</span>
                    {j.closed && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#c0392b", background: "#fdeceb" }}>
                        非公開
                      </span>
                    )}
                    {!!j.hired && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#0a7d3c", background: "#e7f7ee" }}>
                        成約済み
                      </span>
                    )}
                    {j.hospitalDeleted && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#7a5b00", background: "#fff8e6" }}>
                        病院アカウント削除済み
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {j.hospitalName}（{j.area}）
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{j.hospitalEmail}{j.hospitalPhone ? ` ・ ${j.hospitalPhone}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>掲載日時: {formatDateTime(j.createdAt)}</div>
                </div>
                <button className="btn-outline" style={{ fontSize: 12 }} disabled={busyId === j.id} onClick={() => handleToggleClosed(j)}>
                  {busyId === j.id ? "処理中..." : j.closed ? "再掲載する" : "非公開にする"}
                </button>
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
        <p className="fee-note" style={{ marginTop: 0 }}>
          運営はやり取りの内容を通常閲覧しません。ここには、医師または病院から記録の開示を依頼されたやり取りのみが表示されます。閲覧は記録確認のみを目的とし、紛争の仲介・解決は行いません。
        </p>
        {conversations === null ? (
          <div className="loading-state">読み込み中...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">開示依頼があるやり取りはありません。</div>
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
                <div style={{ fontSize: 11, color: "#c0392b", marginTop: 4 }}>
                  🚩 {c.disputeFlaggedBy === "doctor" ? "医師" : "病院"}から開示依頼（{formatDateTime(c.disputeFlaggedAt)}）
                  {c.disputeReason && <div style={{ color: "#7a5b00", marginTop: 2 }}>理由: {c.disputeReason}</div>}
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
