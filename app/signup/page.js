"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState("doctor");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "doctor" || roleParam === "hospital") setRole(roleParam);
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!agreeToTerms) {
      setError("利用規約への同意が必要です");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("role", role);
      form.append("displayName", displayName);
      form.append("email", email);
      form.append("password", password);
      form.append("agreeToTerms", "true");
      if (role === "doctor") {
        form.append("licenseNumber", licenseNumber);
        form.append("specialty", specialty);
        if (resumeFile) form.append("resumeFile", resumeFile);
        if (licenseFile) form.append("licenseFile", licenseFile);
      }
      const res = await fetch("/api/auth/signup", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
        setLoading(false);
        return;
      }
      router.push("/jobs");
      router.refresh();
    } catch (err) {
      setError("通信エラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <div className="wrap-narrow">
      <Link href="/" className="brand" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
        DocLink <span className="badge">Prototype</span>
      </Link>
      <div className="card">
        <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>会員登録</h1>

        <div className="role-toggle">
          <button type="button" className={role === "doctor" ? "active" : ""} onClick={() => setRole("doctor")}>
            🩺 医師として登録
          </button>
          <button type="button" className={role === "hospital" ? "active" : ""} onClick={() => setRole("hospital")}>
            🏥 病院として登録
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field">
            {role === "hospital" ? "病院名" : "お名前"}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={role === "hospital" ? "例）〇〇総合病院" : "例）山田 太郎"}
              required
            />
          </label>
          <label className="field">
            メールアドレス
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          {role === "doctor" && (
            <>
              <div style={{ borderTop: "1px solid #eee", margin: "18px 0 14px", paddingTop: 14 }}>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
                  医師の実在確認のため、以下の情報・書類のご提出をお願いしています。履歴書・医師免許証は本人確認のみに利用し、病院に共有されることはありません。専門医資格は病院が候補者を確認する際に表示されます。
                </p>
              </div>
              <label className="field">
                医籍登録番号（任意）
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="例）第000000号"
                />
              </label>
              <label className="field">
                専門医資格（任意・病院に表示されます）
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="例）日本内科学会 総合内科専門医"
                />
              </label>
              <label className="field">
                履歴書（PDF/画像・必須）
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
              <label className="field">
                医師免許証のコピー（PDF/画像・必須）
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
            </>
          )}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "#374151", margin: "16px 0" }}>
            <input
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              style={{ marginTop: 2 }}
              required
            />
            <span>
              <Link href="/terms" target="_blank" style={{ color: "#1a56db", fontWeight: 700 }}>
                利用規約
              </Link>
              に同意します
            </span>
          </label>

          <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "処理中..." : "登録する"}
          </button>
        </form>

        <p className="fee-note" style={{ marginTop: 14, textAlign: "center" }}>
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" style={{ color: "#1a56db", fontWeight: 700 }}>
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
