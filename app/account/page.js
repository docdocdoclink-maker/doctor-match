"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "../components/Topbar";
import { EMPLOYMENT_PREFERENCES } from "../../lib/jobOptions";

export default function AccountPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (!s.loggedIn) router.push("/login");
      });
    fetch("/api/account")
      .then((r) => r.json())
      .then(setForm);
  }, [router]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "エラーが発生しました");
      return;
    }
    setSaved(true);
  }

  if (!session?.loggedIn || !form) return null;

  const isDoctor = session.role === "doctor";

  return (
    <>
      <Topbar session={session} />
      <main className="wrap">
        <div className="card" style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>プロフィール編集</h1>
          {error && <div className="error-box">{error}</div>}
          {saved && <div style={{ fontSize: 13, color: "#0a7d3c", marginBottom: 12 }}>✓ 保存しました</div>}
          <form onSubmit={handleSubmit}>
            <label className="field">
              {isDoctor ? "お名前" : "病院名"}
              <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} required />
            </label>

            {isDoctor ? (
              <>
                <label className="field">
                  医籍登録番号（任意）
                  <input value={form.licenseNumber} onChange={(e) => update("licenseNumber", e.target.value)} placeholder="例）第000000号" />
                </label>
                <label className="field">
                  希望する勤務形態（任意・病院に表示されます）
                  <select
                    value={form.desiredEmploymentType}
                    onChange={(e) => update("desiredEmploymentType", e.target.value)}
                  >
                    <option value="">指定なし</option>
                    {EMPLOYMENT_PREFERENCES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  保有資格・専門医（任意・病院に表示されます）
                  <textarea
                    value={form.specialty}
                    onChange={(e) => update("specialty", e.target.value)}
                    placeholder={"複数ある場合は改行して記載してください\n例）日本内科学会 総合内科専門医\n日本消化器内視鏡学会 専門医"}
                  />
                </label>
                <p className="fee-note">
                  希望する求人の条件（エリア・形態・診療科・メモ）は
                  <Link href="/jobs" style={{ color: "#1a56db", fontWeight: 700 }}>
                    {" "}
                    求人一覧ページの「🔔 求人アラート設定」
                  </Link>
                  から編集できます。
                </p>
              </>
            ) : (
              <label className="field">
                電話番号
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="例）03-1234-5678" required />
              </label>
            )}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
