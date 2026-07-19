"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "../../components/Topbar";
import JobFormFields from "../JobFormFields";
import { DEPT_CATEGORIES } from "../../../lib/depts";

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
    city: "",
    access: "",
    dept: DEPT_CATEGORIES[0].depts[0],
    dateText: "",
    workDate: "",
    workDateOngoing: false,
    payUnit: "日当",
    payAmount: "",
    payNote: "",
    desc: "",
    headcount: "",
    emergencyVolume: "",
    outpatientVolume: "",
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
            <JobFormFields form={form} update={update} firstHireFeeAvailable={!session.firstHireFeeUsed} />

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "掲載中..." : "掲載する"}
            </button>
            <p className="fee-note">
              {!session.firstHireFeeUsed
                ? "掲載無料。初回契約（1件目の成約）は手数料も無料です（2件目以降はスポット・当直5,000円／非常勤10,000円／常勤20,000円）。"
                : "掲載無料。採用が決まった場合のみ手数料が発生します（スポット・当直5,000円／非常勤10,000円／常勤20,000円）。"}
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
