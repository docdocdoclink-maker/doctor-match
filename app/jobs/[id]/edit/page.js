"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "../../../components/Topbar";
import JobFormFields from "../../JobFormFields";

function jobToForm(job) {
  return {
    title: job.title,
    type: job.type,
    area: job.area,
    city: job.city || "",
    access: job.access || "",
    dept: job.dept,
    dateText: job.date_text,
    workDate: job.work_date || "",
    workDateOngoing: !!job.work_date_ongoing,
    payText: job.pay_text,
    payAmount: job.pay_amount ?? "",
    desc: job.desc,
    emergencyVolume: job.emergency_volume || "",
    outpatientVolume: job.outpatient_volume || "",
    nightDutyNote: job.night_duty_note || "",
    backupNote: job.backup_note || "",
    hospitalWebsite: job.hospital_website || "",
  };
}

export default function EditJobPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (!s.loggedIn || s.role !== "hospital") router.push("/jobs");
      });
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        const job = (data.jobs || []).find((j) => String(j.id) === String(id));
        if (!job) {
          setNotFound(true);
          return;
        }
        setForm(jobToForm(job));
      });
  }, [id, router]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "エラーが発生しました");
      setSubmitting(false);
      return;
    }
    router.push(`/jobs/${id}`);
  }

  if (!session?.loggedIn) return null;

  if (notFound) {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <p>求人が見つかりませんでした。</p>
        </main>
      </>
    );
  }

  if (!form) {
    return (
      <>
        <Topbar session={session} />
        <main className="wrap">
          <div className="loading-state">読み込み中...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar session={session} />
      <main className="wrap">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>求人を編集する</h1>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSubmit}>
            <JobFormFields form={form} update={update} />

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "保存中..." : "変更を保存する"}
            </button>
            <p className="fee-note">保存すると「最終確認日」も本日の日付に更新されます。</p>
          </form>
        </div>
      </main>
    </>
  );
}
