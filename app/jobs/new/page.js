"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "../../components/Topbar";
import { DEPT_CATEGORIES } from "../../../lib/depts";
import { getFeeForJobType, formatYen } from "../../../lib/pricing";

export default function NewJobPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    hospitalName: "",
    title: "",
    type: "非常勤",
    area: "東京都",
    access: "",
    dept: DEPT_CATEGORIES[0].depts[0],
    dateText: "",
    payText: "",
    desc: "",
    emergencyVolume: "",
    nightDutyNote: "",
    backupNote: "",
    hospitalWebsite: "",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (!s.loggedIn || s.role !== "hospital") {
          router.push("/jobs");
        }
      });
  }, [router]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "エラーが発生しました");
      setSubmitting(false);
      return;
    }
    router.push(`/jobs/${data.job.id}`);
  }

  if (!session?.loggedIn) return null;

  if (session.verificationStatus === "pending") {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <div className="card" style={{ maxWidth: 520 }}>
            <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>求人を掲載する（無料）</h1>
            <p className="fee-note">
              ⏳ ご登録内容を確認中です。確認が完了すると求人を掲載できるようになります（メールでお知らせします）。
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar session={session} />
      <main className="wrap">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>求人を掲載する（無料）</h1>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label className="field">
              タイトル
              <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="例）土曜日当直医募集" required />
            </label>
            <label className="field">
              形態
              <select value={form.type} onChange={(e) => update("type", e.target.value)}>
                <option value="非常勤">非常勤</option>
                <option value="当直">当直</option>
                <option value="日当直">日当直</option>
                <option value="常勤">常勤</option>
              </select>
              <span className="fee-note" style={{ margin: "4px 0 0" }}>
                成約時の手数料: {formatYen(getFeeForJobType(form.type))}
              </span>
            </label>
            <label className="field">
              エリア
              <select value={form.area} onChange={(e) => update("area", e.target.value)}>
                <option value="東京都">東京都</option>
                <option value="神奈川県">神奈川県</option>
                <option value="埼玉県">埼玉県</option>
                <option value="千葉県">千葉県</option>
                <option value="茨城県">茨城県</option>
              </select>
            </label>
            <label className="field">
              アクセス（最寄駅など・任意）
              <input
                value={form.access}
                onChange={(e) => update("access", e.target.value)}
                placeholder="例）JR〇〇駅から徒歩5分"
              />
            </label>
            <label className="field">
              診療科
              <select value={form.dept} onChange={(e) => update("dept", e.target.value)}>
                {DEPT_CATEGORIES.map((cat) => (
                  <optgroup key={cat.group} label={cat.group}>
                    {cat.depts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field">
              日時
              <input
                value={form.dateText}
                onChange={(e) => update("dateText", e.target.value)}
                placeholder="例）2026/07/12(土) 17:00〜翌9:00"
                required
              />
            </label>
            <label className="field">
              報酬
              <input value={form.payText} onChange={(e) => update("payText", e.target.value)} placeholder="例）日当 60,000円" required />
            </label>
            <label className="field">
              業務内容
              <textarea value={form.desc} onChange={(e) => update("desc", e.target.value)} placeholder="業務内容を記載してください" required />
            </label>

            <div style={{ borderTop: "1px solid #eee", margin: "18px 0 14px", paddingTop: 14 }}>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
                以下は任意項目です。当直の実態が伝わると、医師が応募を判断しやすくなります。
              </p>
            </div>
            <label className="field">
              救急車搬送件数の目安（任意）
              <input
                value={form.emergencyVolume}
                onChange={(e) => update("emergencyVolume", e.target.value)}
                placeholder="例）年間2,000件"
              />
            </label>
            <label className="field">
              当直体制の概要（任意）
              <input
                value={form.nightDutyNote}
                onChange={(e) => update("nightDutyNote", e.target.value)}
                placeholder="例）整形外科医1名＋救急医常駐"
              />
            </label>
            <label className="field">
              バックアップ体制（任意）
              <input
                value={form.backupNote}
                onChange={(e) => update("backupNote", e.target.value)}
                placeholder="例）オンコールで常勤医に相談可"
              />
            </label>
            <label className="field">
              病院公式サイトURL（任意）
              <input
                type="url"
                value={form.hospitalWebsite}
                onChange={(e) => update("hospitalWebsite", e.target.value)}
                placeholder="例）https://example-hospital.jp"
              />
            </label>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "掲載中..." : "掲載する"}
            </button>
            <p className="fee-note">
              掲載無料。採用が決まった場合のみ手数料が発生します（スポット・当直5,000円／非常勤10,000円／常勤20,000円）。
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
