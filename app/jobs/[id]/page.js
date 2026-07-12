"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "../../components/Topbar";
import { getFeeForJobType, formatYen, getPaymentLinkForJobType, isFreeCampaignActive } from "../../../lib/pricing";
import { PREFECTURES, SHIFT_TYPES, WEEKDAYS, SKILLS } from "../../../lib/jobOptions";
import { ALL_DEPTS } from "../../../lib/depts";

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

function formatDateOnly(sqliteText) {
  if (!sqliteText) return "";
  return new Date(sqliteText.replace(" ", "T") + "Z").toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatShortTime(sqliteText) {
  return new Date(sqliteText.replace(" ", "T") + "Z").toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// キーワードが相手の直近メッセージに含まれていれば、その定型文を上位に表示する。
// 本物のAI生成ではなく、単純なキーワード一致による並べ替え。
const DOCTOR_QUICK_REPLIES = [
  { text: "勤務を希望します", keywords: ["希望", "応募", "決定", "大丈夫", "実績"] },
  { text: "当直室の設備について教えてください", keywords: ["設備", "部屋", "環境", "当直室"] },
  { text: "駐車場はありますか", keywords: ["駐車", "車", "パーキング"] },
  { text: "この日程で応募したいです", keywords: ["日程", "応募", "決定", "大丈夫", "実績"] },
  { text: "報酬・条件について相談したいです", keywords: ["報酬", "給与", "条件", "円", "手当"] },
  { text: "面談・面接は可能でしょうか", keywords: ["面談", "面接", "オンライン"] },
];
const HOSPITAL_QUICK_REPLIES = [
  { text: "ご応募ありがとうございます。詳細をご説明します。", keywords: ["応募", "興味", "お願い", "検討"] },
  { text: "オンラインでの面談も可能です。日程調整しましょう", keywords: ["面談", "面接", "会って", "オンライン"] },
  { text: "当直室に個室・布団をご用意しています", keywords: ["当直室", "設備", "布団", "仮眠", "部屋"] },
  { text: "駐車場は病院敷地内に完備しています", keywords: ["駐車", "車", "パーキング"] },
  { text: "報酬は経験に応じて相談可能です", keywords: ["報酬", "給与", "条件", "円", "手当"] },
  { text: "ご不明な点があればいつでもご連絡ください", keywords: [] },
];

const MESSAGE_MAX_LENGTH = 2000;

function rankQuickReplies(templates, lastIncomingText) {
  const text = lastIncomingText || "";
  return [...templates]
    .map((t, i) => ({ ...t, i, score: t.keywords.filter((k) => text.includes(k)).length }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
}

// Optional context about actual on-call conditions, filled in by the
// hospital at posting time. Only shown when at least one field is present —
// no "unconfirmed" placeholders for the rest, since most postings will
// leave some of these blank.
function WorkRealitySection({ job }) {
  const items = [
    { label: "外来患者数の目安", value: job.outpatient_volume },
    { label: "救急車搬送件数の目安", value: job.emergency_volume },
    { label: "当直体制", value: job.night_duty_note },
    { label: "バックアップ体制", value: job.backup_note },
  ].filter((item) => item.value);

  if (items.length === 0) return null;

  return (
    <div style={{ borderTop: "1px solid #eee", paddingTop: 16, marginTop: 4 }}>
      <h2 style={{ fontSize: 14, margin: "0 0 10px", color: "#0d1b33" }}>勤務の実態</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              gap: 10,
              fontSize: 13,
              background: "#f9fafb",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <span style={{ color: "#6b7280", flexShrink: 0, minWidth: 140 }}>{item.label}</span>
            <span style={{ color: "#16202e", fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [job, setJob] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeDoctorId, setActiveDoctorId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [anonymous, setAnonymous] = useState(false);
  const [shareDocuments, setShareDocuments] = useState(false);
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [hireConfirmedByHospital, setHireConfirmedByHospital] = useState(false);
  const [confirmingHire, setConfirmingHire] = useState(false);
  const [cancelingHire, setCancelingHire] = useState(false);
  const [cancelHireError, setCancelHireError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastArea, setBroadcastArea] = useState("");
  const [broadcastDept, setBroadcastDept] = useState("");
  const [broadcastShiftType, setBroadcastShiftType] = useState("");
  const [broadcastWeekdays, setBroadcastWeekdays] = useState([]);
  const [broadcastSkills, setBroadcastSkills] = useState([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const threadRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession);
    loadJob();
    fetch(`/api/jobs/${id}/view`, { method: "POST" }).catch(() => {});
    // Navigating from one job page to another doesn't remount this
    // component (same route pattern, just a different [id]), so without
    // this, activeDoctorId/messages from the previous job would otherwise
    // stick around — for a doctor it's literally the same value
    // (their own user id) both times, so the effect below wouldn't have
    // re-run on its own.
    setActiveDoctorId(null);
    setMessages([]);
    setConversations([]);
  }, [id]);

  useEffect(() => {
    if (!session) return;
    if (session.role === "hospital") {
      loadConversations();
    } else if (session.role === "doctor") {
      setActiveDoctorId(session.userId);
    }
  }, [session, id]);

  useEffect(() => {
    if (activeDoctorId) loadMessages(activeDoctorId);
  }, [activeDoctorId, id]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadJob() {
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setJob(data.job);
  }

  async function loadConversations() {
    const res = await fetch(`/api/jobs/${id}/conversations`);
    const data = await res.json();
    setConversations(data.conversations || []);
    if (!activeDoctorId && data.conversations?.length > 0) {
      setActiveDoctorId(data.conversations[0].doctorUserId);
    }
  }

  async function loadMessages(doctorId) {
    const url = new URL(`/api/jobs/${id}/messages`, window.location.origin);
    url.searchParams.set("doctorId", doctorId);
    const res = await fetch(url);
    const data = await res.json();
    setMessages(data.messages || []);
    setAnonymous(!!data.anonymous);
    setShareDocuments(!!data.shareDocuments);
    setSharedDocuments(data.documents || []);
    setHireConfirmedByHospital(!!data.hireConfirmedByHospital);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setSending(true);
    setUploadError("");

    const form = new FormData();
    form.append("text", text.trim());
    if (session.role === "doctor") {
      form.append("anonymous", String(anonymous));
      form.append("shareDocuments", String(shareDocuments));
    }
    if (session.role === "hospital") form.append("doctorId", String(activeDoctorId));
    if (file) form.append("file", file);

    const res = await fetch(`/api/jobs/${id}/messages`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setUploadError(data.error || "送信に失敗しました");
      setSending(false);
      return;
    }
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await loadMessages(activeDoctorId);
    if (session.role === "hospital") await loadConversations();
    setSending(false);
  }

  async function handleHire() {
    setHiring(true);
    const res = await fetch(`/api/jobs/${id}/hire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorUserId: activeDoctorId || null }),
    });
    if (res.ok) {
      await loadJob();
      if (activeDoctorId) {
        await loadMessages(activeDoctorId);
        await loadConversations();
      }
    }
    setHiring(false);
  }

  async function handleConfirmHire() {
    setConfirmingHire(true);
    const res = await fetch(`/api/jobs/${id}/confirm-hire`, { method: "POST" });
    if (res.ok) await loadMessages(activeDoctorId);
    setConfirmingHire(false);
  }

  async function handleCancelHire() {
    setCancelingHire(true);
    setCancelHireError("");
    const res = await fetch(`/api/jobs/${id}/cancel-hire`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setCancelHireError(data.error || "取り消しに失敗しました");
      setCancelingHire(false);
      return;
    }
    await loadJob();
    if (activeDoctorId) {
      await loadMessages(activeDoctorId);
      await loadConversations();
    }
    setCancelingHire(false);
  }

  async function handleConfirm() {
    setConfirming(true);
    const res = await fetch(`/api/jobs/${id}/confirm`, { method: "POST" });
    if (res.ok) await loadJob();
    setConfirming(false);
  }

  async function handleToggleClosed() {
    setClosing(true);
    const res = await fetch(`/api/jobs/${id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: !job.closed }),
    });
    if (res.ok) await loadJob();
    setClosing(false);
  }

  function toggleBroadcastList(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleBroadcast(e) {
    e.preventDefault();
    setBroadcastError("");
    setBroadcastSending(true);
    const res = await fetch(`/api/jobs/${id}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: broadcastArea,
        dept: broadcastDept,
        shiftType: broadcastShiftType,
        weekdays: broadcastWeekdays,
        skills: broadcastSkills,
        message: broadcastMessage,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBroadcastError(data.error || "送信に失敗しました");
      setBroadcastSending(false);
      return;
    }
    setBroadcastResult(data.matchedCount);
    setBroadcastMessage("");
    setBroadcastSending(false);
    await loadConversations();
  }

  if (notFound) {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <p>求人が見つかりませんでした。</p>
          <Link href="/jobs" className="back-link">
            ← 一覧に戻る
          </Link>
        </main>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <div className="loading-state">読み込み中...</div>
        </main>
      </>
    );
  }

  const isDoctor = session?.loggedIn && session.role === "doctor";
  const isOwnerHospital = session?.loggedIn && session.role === "hospital" && session.userId === job.hospital_user_id;
  const showingOutreachForm = isOwnerHospital && showBroadcast;
  const templates = session?.role === "doctor" ? DOCTOR_QUICK_REPLIES : HOSPITAL_QUICK_REPLIES;
  const lastIncoming = [...messages].reverse().find((m) => m.sender_role !== "system" && m.sender_role !== session?.role);
  const quickReplies = rankQuickReplies(templates, lastIncoming?.text);

  return (
    <>
      <Topbar session={session} />
      <main className="wrap">
        <Link href="/jobs" className="back-link">
          ← 一覧に戻る
        </Link>

        <div className="detail-grid">
          <div className="card">
            <div className="job-card-top">
              <span className="tag tag-type">{job.type}</span>
              <span className="tag tag-area">{job.city ? `${job.area} ${job.city}` : job.area}</span>
              {!!job.closed && <span className="tag tag-hired">非公開</span>}
            </div>
            <h1 style={{ fontSize: 20, margin: "6px 0" }}>{job.title}</h1>
            <div style={{ color: "#4b5563", marginBottom: 4, fontSize: 14 }}>{job.hospital_name}</div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                最終確認日: {formatDateOnly(job.confirmed_at || job.created_at)}
              </span>
              {isOwnerHospital && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, marginTop: 8 }}>
                  <Link href={`/jobs/${id}/edit`} className="btn-outline" style={{ fontSize: 11, padding: "3px 10px", textDecoration: "none" }}>
                    内容を編集する
                  </Link>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ fontSize: 11, padding: "3px 10px" }}
                    disabled={confirming}
                    onClick={handleConfirm}
                  >
                    {confirming ? "更新中..." : "本日時点で最新（確認日を更新）"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ fontSize: 11, padding: "3px 10px" }}
                    disabled={closing}
                    onClick={handleToggleClosed}
                  >
                    {closing ? "処理中..." : job.closed ? "求人を再掲載する" : "求人を取り下げる"}
                  </button>
                </div>
              )}
            </div>
            {isOwnerHospital && !!job.closed && (
              <p className="fee-note" style={{ marginTop: -8, marginBottom: 16 }}>
                現在非公開です。医師の一覧には表示されません（この求人ページ自体は貴院からのみ引き続き閲覧できます）。
              </p>
            )}

            <table className="detail-table">
              <tbody>
                {job.access && (
                  <tr>
                    <th>アクセス</th>
                    <td>{job.access}</td>
                  </tr>
                )}
                <tr>
                  <th>診療科</th>
                  <td>{job.dept}</td>
                </tr>
                <tr>
                  <th>日時</th>
                  <td>{job.date_text || (job.work_date_ongoing ? "随時・継続的に募集中" : "")}</td>
                </tr>
                <tr>
                  <th>報酬</th>
                  <td>{job.pay_text}</td>
                </tr>
                <tr>
                  <th>業務内容</th>
                  <td>{job.desc}</td>
                </tr>
              </tbody>
            </table>

            <WorkRealitySection job={job} />

            {isDoctor && !job.hired && (
              <div style={{ borderTop: "1px solid #eee", paddingTop: 16 }}>
                <p className="fee-note">
                  {isFreeCampaignActive()
                    ? "※ 今年度中は病院側の手数料も無料キャンペーン中です（医師側は元々完全無料）"
                    : "※ 成約時のみ病院側に手数料が発生します（医師側は完全無料）"}
                </p>
              </div>
            )}
          </div>

          <div className="detail-chat">
            {job.hospital_website && (
              <div style={{ marginBottom: 12 }}>
                <a
                  href={job.hospital_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1a56db", fontWeight: 700, fontSize: 13 }}
                >
                  🔗 {job.hospital_name} 公式サイトを見る
                </a>
              </div>
            )}

            {isOwnerHospital && (
              <div style={{ marginBottom: 12 }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  会話中の医師（{conversations.length}件）
                  <select
                    value={activeDoctorId || ""}
                    onChange={(e) => setActiveDoctorId(Number(e.target.value))}
                  >
                    {conversations.length === 0 && <option>まだ問い合わせがありません</option>}
                    {conversations.map((c) => (
                      <option key={c.doctorUserId} value={c.doctorUserId}>
                        {c.displayName}
                        {c.desiredEmploymentType ? `　${c.desiredEmploymentType}希望` : ""}
                        {c.specialty ? `　🏅${c.specialty}` : ""}
                        {c.lastAt ? ` ・ ${formatShortTime(c.lastAt)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {(() => {
                  const active = conversations.find((c) => c.doctorUserId === activeDoctorId);
                  if (!active) return null;
                  const desiredParts = [active.desiredArea, active.desiredType, active.desiredDept].filter(Boolean);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {(active.desiredEmploymentType || active.specialty) && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {active.desiredEmploymentType && (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#1a56db",
                                background: "#e0edff",
                                borderRadius: 999,
                                padding: "3px 10px",
                              }}
                            >
                              {active.desiredEmploymentType}希望
                            </div>
                          )}
                          {active.specialty && (
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#8a5a00",
                                background: "#fff3cd",
                                borderRadius: 8,
                                padding: "4px 10px",
                                whiteSpace: "pre-line",
                              }}
                            >
                              🏅 保有資格：{active.specialty}
                            </div>
                          )}
                        </div>
                      )}
                      {(desiredParts.length > 0 || active.desiredNote) && (
                        <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: "8px 10px" }}>
                          <strong>この医師の希望条件：</strong>
                          {desiredParts.length > 0 && <span>{desiredParts.join(" / ")}</span>}
                          {active.desiredNote && <div style={{ marginTop: 2, color: "#4b5563" }}>{active.desiredNote}</div>}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!showBroadcast ? (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ marginTop: 8, fontSize: 12 }}
                    onClick={() => {
                      setShowBroadcast(true);
                      setBroadcastResult(null);
                    }}
                  >
                    🔔 条件に合う医師に一斉送信する
                  </button>
                ) : (
                  <form onSubmit={handleBroadcast} style={{ marginTop: 10, background: "#f9fafb", padding: 12, borderRadius: 8 }}>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px" }}>
                      指定した条件を「求人アラート」として登録している医師に、個別にメッセージを送ります。どの医師に届いたかは表示されません — 返信があった医師とだけ、その後やり取りできます。
                    </p>
                    {broadcastError && <div className="error-box" style={{ fontSize: 12 }}>{broadcastError}</div>}
                    {broadcastResult !== null && (
                      <div style={{ fontSize: 12, color: "#0a7d3c", marginBottom: 8 }}>
                        ✓ {broadcastResult}人の医師に送信しました
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <label className="field" style={{ marginBottom: 0 }}>
                        エリア
                        <select value={broadcastArea} onChange={(e) => setBroadcastArea(e.target.value)}>
                          <option value="">指定なし</option>
                          {PREFECTURES.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ marginBottom: 0 }}>
                        診療科
                        <select value={broadcastDept} onChange={(e) => setBroadcastDept(e.target.value)}>
                          <option value="">指定なし</option>
                          {ALL_DEPTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ marginBottom: 0 }}>
                        勤務形態
                        <select value={broadcastShiftType} onChange={(e) => setBroadcastShiftType(e.target.value)}>
                          <option value="">指定なし</option>
                          {SHIFT_TYPES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>曜日（任意・複数選択可）</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {WEEKDAYS.map((w) => (
                          <label
                            key={w}
                            style={{
                              fontSize: 12,
                              border: `1px solid ${broadcastWeekdays.includes(w) ? "#1a56db" : "#d1d5db"}`,
                              background: broadcastWeekdays.includes(w) ? "#e9f0ff" : "#fff",
                              color: broadcastWeekdays.includes(w) ? "#1a56db" : "#4b5563",
                              borderRadius: 999,
                              padding: "3px 10px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={broadcastWeekdays.includes(w)}
                              onChange={() => toggleBroadcastList(broadcastWeekdays, setBroadcastWeekdays, w)}
                              style={{ display: "none" }}
                            />
                            {w}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>対応可能な処置・スキル（任意・複数選択可）</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {SKILLS.map((s) => (
                          <label
                            key={s}
                            style={{
                              fontSize: 12,
                              border: `1px solid ${broadcastSkills.includes(s) ? "#1a56db" : "#d1d5db"}`,
                              background: broadcastSkills.includes(s) ? "#e9f0ff" : "#fff",
                              color: broadcastSkills.includes(s) ? "#1a56db" : "#4b5563",
                              borderRadius: 999,
                              padding: "3px 10px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={broadcastSkills.includes(s)}
                              onChange={() => toggleBroadcastList(broadcastSkills, setBroadcastSkills, s)}
                              style={{ display: "none" }}
                            />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="field" style={{ marginBottom: 8 }}>
                      メッセージ
                      <textarea
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="この条件に合う勤務をお願いできる方はいらっしゃいますか？"
                        required
                      />
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="submit" className="btn-primary" disabled={broadcastSending}>
                        {broadcastSending ? "送信中..." : "送信する"}
                      </button>
                      <button type="button" className="btn-outline" onClick={() => setShowBroadcast(false)}>
                        閉じる
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {isOwnerHospital && activeDoctorId && !showingOutreachForm && (
              <div style={{ marginBottom: 12, background: "#f9fafb", borderRadius: 8, padding: 12 }}>
                <h3 style={{ fontSize: 13, margin: "0 0 6px", color: "#0d1b33" }}>提出書類</h3>
                {sharedDocuments.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {sharedDocuments.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/uploads/${d.stored_name}`}
                        style={{ fontSize: 12, color: "#1a56db", fontWeight: 700 }}
                      >
                        📎 {d.type === "resume" ? "履歴書" : "医師免許"}：{d.original_name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                    この医師はまだ書類を共有していません。
                  </p>
                )}
              </div>
            )}

            {showingOutreachForm && (
              <p className="fee-note">送信フォームを閉じると、選択中の医師とのメッセージが表示されます。</p>
            )}

            {!showingOutreachForm && (
              <>
            <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>メッセージ</h2>
            <div className="chat-thread" ref={threadRef}>
              {(!activeDoctorId || messages.length === 0) ? (
                <div className="chat-empty">
                  まだメッセージはありません。
                  <br />
                  気になる点を病院に直接聞いてみましょう。
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.sender_role === "system"
                        ? "msg-system"
                        : `msg ${m.sender_role === session?.role ? "msg-mine" : "msg-theirs"}`
                    }
                  >
                    {m.sender_role === "system" ? (
                      <>✓ {m.text}</>
                    ) : (
                      <>
                        {m.text}
                        {m.attachment_path && (
                          <div style={{ marginTop: 6 }}>
                            <a
                              href={`/api/uploads/${m.attachment_path}`}
                              style={{ color: "inherit", textDecoration: "underline", fontSize: 12 }}
                            >
                              📎 {m.attachment_name}
                            </a>
                          </div>
                        )}
                        <div className="msg-time">
                          {m.sender_role === "doctor" ? "医師" : "病院"} ・ {formatShortTime(m.created_at)}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {session?.loggedIn && session.verificationStatus === "pending" ? (
              <p className="fee-note">
                ⏳ ご登録内容を確認中です。確認が完了するとメッセージを送信できるようになります（メールでお知らせします）。
              </p>
            ) : session?.loggedIn && (isDoctor || activeDoctorId) ? (
              <>
                {lastIncoming && quickReplies[0]?.score > 0 && (
                  <div style={{ fontSize: 11, color: "#1a56db", fontWeight: 700, marginBottom: 4 }}>
                    💡 相手のメッセージから返信候補をおすすめ表示中
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {quickReplies.map((q, idx) => {
                    const isRecommended = idx === 0 && q.score > 0;
                    const isSelected = text === q.text;
                    return (
                      <button
                        key={q.text}
                        type="button"
                        onClick={(e) => {
                          setText(q.text);
                          e.currentTarget.blur();
                        }}
                        style={{
                          fontSize: 11,
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: isSelected ? "1px solid #1a56db" : "1px solid #d1d5db",
                          background: isSelected ? "#e9f0ff" : "#f9fafb",
                          color: isSelected ? "#1a56db" : "#4b5563",
                          fontWeight: isSelected ? 700 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {isRecommended ? "💡 " : ""}
                        {q.text}
                      </button>
                    );
                  })}
                </div>

                {isDoctor && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={anonymous}
                        onChange={(e) => {
                          setAnonymous(e.target.checked);
                          if (e.target.checked) setShareDocuments(false);
                        }}
                      />
                      匿名で連絡する（病院には「匿名の医師」として表示されます）
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={shareDocuments}
                        onChange={(e) => {
                          setShareDocuments(e.target.checked);
                          if (e.target.checked) setAnonymous(false);
                        }}
                      />
                      履歴書・医師免許をこの病院に共有する（オフのままだと病院には表示されません）
                    </label>
                    {(anonymous || shareDocuments) && (
                      <p className="fee-note" style={{ marginTop: -4 }}>
                        履歴書・医師免許には氏名が含まれるため、匿名と書類共有は同時に選べません。
                      </p>
                    )}
                  </>
                )}

                {uploadError && <div className="error-box">{uploadError}</div>}

                <form className="chat-form" onSubmit={handleSend} style={{ flexWrap: "wrap" }}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    placeholder="メッセージを入力..."
                    autoComplete="off"
                    maxLength={MESSAGE_MAX_LENGTH}
                    rows={composerFocused || text ? 4 : 1}
                    style={{ flex: 1, minWidth: 140, resize: "vertical", transition: "all 0.15s ease" }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 11, maxWidth: 130 }}
                  />
                  <button type="submit" className="btn-primary" disabled={sending}>
                    送信
                  </button>
                </form>
                <p className="fee-note" style={{ marginTop: 4, textAlign: "right" }}>
                  {text.length} / {MESSAGE_MAX_LENGTH}文字
                </p>
                {file && <p className="fee-note">添付: {file.name}</p>}
                <p className="fee-note">
                  {isDoctor
                    ? "履歴書・医師免許は上のチェックで共有できます。そのほか、ご希望があればPDF・Word・Excel・画像のファイルも添付できます（10MBまで）。"
                    : "ご希望があればPDF・Word・Excel・画像のファイルを添付できます（10MBまで）。"}
                </p>
                <p className="fee-note">
                  メッセージを送信すると相手にメール通知が届き、その返信をお待ちいただく形になります。相手の状況によっては返信までお時間がかかる場合がありますので、あらかじめご了承ください。
                </p>
              </>
            ) : isOwnerHospital ? (
              <p className="fee-note">
                まだ医師からの問い合わせがありません。上の「条件に合う医師に一斉送信する」から、希望条件が合う医師に直接声をかけることもできます。
              </p>
            ) : (
              <p className="fee-note">
                メッセージを送るには{" "}
                <Link href="/login" style={{ color: "#1a56db", fontWeight: 700 }}>
                  ログイン
                </Link>
                が必要です。
              </p>
            )}
              </>
            )}

            {(isOwnerHospital || isDoctor) && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                {!job.hired ? (
                  <>
                    {(isOwnerHospital || (isDoctor && activeDoctorId)) && (
                      <button className="btn-success" onClick={handleHire} disabled={hiring}>
                        {hiring ? "処理中..." : "採用が決まりました（成約報告）"}
                      </button>
                    )}
                    {isOwnerHospital && (
                      <p className="fee-note">
                        {activeDoctorId
                          ? "上で選択中の医師が採用されたものとして報告します。報告すると医師に通知が届き、医師側で内容を確認していただく流れになります。"
                          : "会話中の医師を選んでから報告すると、その医師に採用決定の通知と確認依頼が届きます。"}
                      </p>
                    )}
                    <p className="fee-note">
                      {isOwnerHospital
                        ? isFreeCampaignActive()
                          ? "🎉 今年度中（2027年3月31日まで）はキャンペーンにより手数料は無料です。"
                          : `成約報告をすると、運営から手数料 ${formatYen(getFeeForJobType(job.type))} の請求書をお送りします。`
                        : "※ 手数料が発生するのは病院側のみです。医師の利用は登録・閲覧・応募・成約を通じて常に無料です。"}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="hired-badge">✓ 成約済み（{formatDateTime(job.hired_at)}）</span>
                    {cancelHireError && <div className="error-box" style={{ fontSize: 12, marginTop: 8 }}>{cancelHireError}</div>}

                    {isOwnerHospital && job.hired_doctor_user_id && (
                      <>
                        {job.hired_reported_by === "doctor" ? (
                          <div style={{ marginTop: 10 }}>
                            {conversations.find((c) => c.doctorUserId === job.hired_doctor_user_id)?.hireConfirmedByHospital ? (
                              <p className="fee-note">✓ あなたも採用について確認済みです（双方合意済み）</p>
                            ) : (
                              <>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button className="btn-success" onClick={handleConfirmHire} disabled={confirmingHire || cancelingHire}>
                                    {confirmingHire ? "処理中..." : "採用について確認する"}
                                  </button>
                                  <button className="btn-outline" onClick={handleCancelHire} disabled={confirmingHire || cancelingHire}>
                                    {cancelingHire ? "処理中..." : "報告が誤りだった場合はこちら"}
                                  </button>
                                </div>
                                <p className="fee-note">
                                  医師からの採用報告の内容に相違なければ、こちらから確認をお願いします。確認すると運営から手数料の請求メールが届きます。相違があれば右のボタンで報告を取り消せます。
                                </p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginTop: 10 }}>
                            <button className="btn-outline" style={{ fontSize: 12 }} onClick={handleCancelHire} disabled={cancelingHire}>
                              {cancelingHire ? "処理中..." : "報告が誤りだった場合はこちら"}
                            </button>
                          </div>
                        )}
                        {(job.hired_reported_by === "hospital" ||
                          conversations.find((c) => c.doctorUserId === job.hired_doctor_user_id)?.hireConfirmedByHospital) &&
                          (isFreeCampaignActive() ? (
                            <p className="fee-note">
                              🎉 今年度中（2027年3月31日まで）はキャンペーンにより手数料は無料です。お支払いは不要です。
                            </p>
                          ) : getPaymentLinkForJobType(job.type) ? (
                            <p className="fee-note">
                              手数料 {formatYen(getFeeForJobType(job.type))} のお支払いは
                              <a
                                href={getPaymentLinkForJobType(job.type)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "#1a56db", fontWeight: 700 }}
                              >
                                {" "}
                                こちらから
                              </a>
                              お願いします。
                            </p>
                          ) : (
                            <p className="fee-note">運営より手数料 {formatYen(getFeeForJobType(job.type))} の請求書をお送りします。</p>
                          ))}
                      </>
                    )}

                    {isDoctor && job.hired_doctor_user_id === session.userId && job.hired_reported_by !== "hospital" && (
                      <div style={{ marginTop: 10 }}>
                        {hireConfirmedByHospital ? (
                          <p className="fee-note">✓ 病院も採用について確認済みです（双方合意済み）</p>
                        ) : (
                          <>
                            <p className="fee-note">病院の確認待ちです（まだ確認されていません）。</p>
                            <button className="btn-outline" style={{ fontSize: 12 }} onClick={handleCancelHire} disabled={cancelingHire}>
                              {cancelingHire ? "処理中..." : "報告を取り消す"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="fee-note">
              採否・条件交渉は病院・医師間で直接行ってください。運営が仲介・あっせん・調停を行うことはなく、トラブルの解決も原則として当事者間で行っていただきます。運営はやり取りの内容を通常閲覧しません。手数料の支払いに関する紛争など、やむを得ず運営による記録確認が必要な場合は、
              <Link href="/contact" style={{ color: "#1a56db", fontWeight: 700 }}>
                お問い合わせフォーム
              </Link>
              よりご連絡ください。
            </p>

            <details style={{ marginTop: 12, background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: "#4b5563", cursor: "pointer" }}>
                やりとり例を見る
              </summary>

              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "12px 0 6px" }}>やりとり例①</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="msg msg-doctor">救急対応はどの程度の頻度でしょうか？バックアップ体制も教えてください。</div>
                <div className="msg msg-hospital">救急車は1晩数台程度です。急変時は当直看護師に加え、オンコールの内科医師にも相談できる体制です。</div>
                <div className="msg msg-doctor">承知しました。この日程で応募したいです。</div>
                <div className="msg msg-hospital">
                  ありがとうございます！よろしくお願いします。当日は9時に医局までお越しください。詳細は前日までにメッセージでご連絡します。
                </div>
              </div>

              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "16px 0 6px" }}>やりとり例②（書類の添付）</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="msg msg-doctor">当直室の様子も見せていただけますか？</div>
                <div className="msg msg-hospital">
                  こちらが当直室の写真です。
                  <div style={{ marginTop: 6 }}>
                    <span style={{ textDecoration: "underline", fontSize: 12 }}>📎 当直室.pdf</span>
                  </div>
                </div>
                <div className="msg msg-doctor">ありがとうございます、イメージが湧きました。</div>
              </div>
            </details>
          </div>
        </div>
      </main>
    </>
  );
}
