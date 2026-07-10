"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "../components/Topbar";
import WelcomeModal from "../components/WelcomeModal";
import { JOB_TYPES, PREFECTURES, SHIFT_TYPES, WEEKDAYS, SKILLS } from "../../lib/jobOptions";
import { ALL_DEPTS } from "../../lib/depts";

function formatDateOnly(sqliteText) {
  if (!sqliteText) return "";
  return new Date(sqliteText.replace(" ", "T") + "Z").toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default function JobsPage() {
  const [session, setSession] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [alert, setAlert] = useState(null);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [filters, setFilters] = useState({ area: "", type: "", dept: "" });
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (s.loggedIn && !s.hasSeenIntro) setShowWelcome(true);
      });
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs));
  }, []);

  useEffect(() => {
    if (session?.loggedIn && session.role === "doctor") {
      fetch("/api/alerts")
        .then((r) => r.json())
        .then((data) => setAlert(data.alert));
    }
  }, [session]);

  // Fixed lists, not derived from currently-live postings — otherwise an
  // area/type with zero postings right now would disappear from both the
  // search filter and (worse) the alert picker, when an alert's whole point
  // is to notify about conditions that don't have a match yet.
  const areas = PREFECTURES;
  const types = JOB_TYPES;
  const depts = ALL_DEPTS;

  const filtered = (jobs || []).filter(
    (j) =>
      (!filters.area || j.area === filters.area) &&
      (!filters.type || j.type === filters.type) &&
      (!filters.dept || j.dept === filters.dept)
  );

  function matchesAlert(job) {
    if (!alert || !alert.active) return false;
    return (
      (!alert.area || job.area === alert.area) &&
      (!alert.type || job.type === alert.type) &&
      (!alert.dept || job.dept === alert.dept)
    );
  }

  async function saveAlert(next) {
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    setAlert(data.alert);
    setAlertPanelOpen(false);
  }

  const alertMatchCount = jobs ? jobs.filter(matchesAlert).length : 0;

  return (
    <>
      <Topbar session={session} />
      {showWelcome && session?.loggedIn && (
        <WelcomeModal session={session} onDismiss={() => setShowWelcome(false)} />
      )}
      <main className="wrap">
        {session?.role === "hospital" ? (
          <>
            <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>掲載中の求人一覧</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
              貴院が掲載した求人の一覧です。医師からの連絡は各求人ページのチャットで確認できます。
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>非常勤・当直バイト求人（関東）</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
              全ての求人を検索・閲覧できます。応募・連絡は病院と直接やり取りできます。
            </p>
          </>
        )}

        <div className="filters">
          <select value={filters.area} onChange={(e) => setFilters({ ...filters, area: e.target.value })}>
            <option value="">エリア: すべて</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">形態: すべて</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={filters.dept} onChange={(e) => setFilters({ ...filters, dept: e.target.value })}>
            <option value="">診療科: すべて</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {session?.loggedIn && session.role === "doctor" && (
            <button className="btn-outline" onClick={() => setAlertPanelOpen(!alertPanelOpen)}>
              🔔 {alert?.active ? "求人アラート設定中" : "求人アラート設定"}
            </button>
          )}
          {session?.loggedIn && session.role === "hospital" && (
            <Link href="/jobs/new" className="btn-primary" style={{ textDecoration: "none" }}>
              ＋ 求人を掲載する（無料）
            </Link>
          )}
        </div>

        {alertPanelOpen && (
          <AlertPanel areas={areas} types={types} depts={depts} alert={alert} onSave={saveAlert} />
        )}

        {!!alert?.active && alertMatchCount > 0 && (
          <div
            style={{
              background: "#eef4ff",
              border: "1px solid #c7dcff",
              color: "#1a56db",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            🔔 保存した条件に合う求人が {alertMatchCount} 件あります
          </div>
        )}

        {!session?.loggedIn && (
          <div
            style={{
              background: "#fff8e6",
              border: "1px solid #ffe08a",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "#7a5b00",
              marginBottom: 16,
            }}
          >
            求人の閲覧は誰でも自由にできます。病院へのメッセージ送信・求人掲載には
            <Link href="/login" style={{ color: "#1a56db", fontWeight: 700 }}>
              {" "}
              ログイン
            </Link>
            が必要です。
          </div>
        )}

        {session?.loggedIn && session.verificationStatus === "pending" && (
          <div
            style={{
              background: "#fff8e6",
              border: "1px solid #ffe08a",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "#7a5b00",
              marginBottom: 16,
            }}
          >
            ⏳ ご登録内容を確認中です。求人の閲覧は引き続きご利用いただけますが、メッセージ送信・求人掲載は確認完了後（通常1〜2営業日）にご利用いただけます。完了次第メールでお知らせします。
          </div>
        )}
        {session?.loggedIn && session.verificationStatus === "rejected" && (
          <div
            style={{
              background: "#fdeceb",
              border: "1px solid #f7c9c4",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "#c0392b",
              marginBottom: 16,
            }}
          >
            ご登録内容の確認結果について、メールにてご案内しております。ご不明な点があればお問い合わせください。
          </div>
        )}

        {jobs === null ? (
          <div className="loading-state">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">条件に合う求人がありません</div>
        ) : (
          <div className="job-list">
            {filtered.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className={`job-card${job.hired ? " is-hired" : ""}`}>
                <div className="job-card-top">
                  <span className="tag tag-type">{job.type}</span>
                  <span className="tag tag-area">{job.area}</span>
                  {!!job.hired && <span className="tag tag-hired">成約済み</span>}
                  {!!job.closed && <span className="tag tag-hired">非公開</span>}
                  {session?.role === "doctor" && matchesAlert(job) && (
                    <span className="tag tag-alert">🔔 条件に一致</span>
                  )}
                </div>
                <h3 className="job-title">{job.title}</h3>
                <div className="job-hospital">{job.hospital_name}</div>
                <div className="job-meta">
                  <span>{job.date_text}</span>
                  <span className="job-pay">{job.pay_text}</span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  最終確認日: {formatDateOnly(job.confirmed_at || job.created_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function AlertPanel({ areas, types, depts, alert, onSave }) {
  const [area, setArea] = useState(alert?.area || "");
  const [type, setType] = useState(alert?.type || "");
  const [dept, setDept] = useState(alert?.dept || "");
  const [note, setNote] = useState(alert?.note || "");
  const [shiftType, setShiftType] = useState(alert?.shift_type || "");
  const [weekdays, setWeekdays] = useState(alert?.weekdays || []);
  const [skills, setSkills] = useState(alert?.skills || []);

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
        <strong>病院から希望に合う条件の求人が新しく掲載されると、通知します。</strong>設定した条件は、あなたにメッセージを送る病院にも「希望条件」として表示されます。
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field" style={{ marginBottom: 0 }}>
          エリア
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">指定なし</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          形態
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">指定なし</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          診療科
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">指定なし</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          勤務形態
          <select value={shiftType} onChange={(e) => setShiftType(e.target.value)}>
            <option value="">指定なし</option>
            {SHIFT_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>希望曜日（任意・複数選択可）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {WEEKDAYS.map((w) => (
            <label
              key={w}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                border: `1px solid ${weekdays.includes(w) ? "#1a56db" : "#d1d5db"}`,
                background: weekdays.includes(w) ? "#e9f0ff" : "#f9fafb",
                color: weekdays.includes(w) ? "#1a56db" : "#4b5563",
                borderRadius: 999,
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={weekdays.includes(w)}
                onChange={() => toggle(weekdays, setWeekdays, w)}
                style={{ display: "none" }}
              />
              {w}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 6 }}>対応可能な処置・スキル（任意・複数選択可）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SKILLS.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                border: `1px solid ${skills.includes(s) ? "#1a56db" : "#d1d5db"}`,
                background: skills.includes(s) ? "#e9f0ff" : "#f9fafb",
                color: skills.includes(s) ? "#1a56db" : "#4b5563",
                borderRadius: 999,
                padding: "3px 10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={skills.includes(s)}
                onChange={() => toggle(skills, setSkills, s)}
                style={{ display: "none" }}
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <label className="field">
        希望条件メモ（任意・病院に表示されます）
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例）土日希望、非常勤メインで探しています"
        />
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          onClick={() => onSave({ active: true, area, type, dept, note, shiftType, weekdays, skills })}
        >
          この条件で通知を受け取る
        </button>
        {!!alert?.active && (
          <>
            <button
              className="btn-outline"
              onClick={() =>
                onSave({ active: false, area: "", type: "", dept: "", note: "", shiftType: "", weekdays: [], skills: [] })
              }
            >
              アラートを解除
            </button>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>通知が不要になったら、こちらでいつでも止められます。</span>
          </>
        )}
      </div>
    </div>
  );
}
