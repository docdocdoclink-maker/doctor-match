"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
        setLoading(false);
        return;
      }
      setDone(true);
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
        <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>新しいパスワードを設定</h1>

        {!token ? (
          <p className="fee-note">
            リンクが不正です。
            <Link href="/forgot-password" style={{ color: "#1a56db", fontWeight: 700 }}>
              パスワード再設定
            </Link>
            をもう一度お試しください。
          </p>
        ) : done ? (
          <p className="fee-note">
            パスワードを再設定しました。
            <Link href="/login" style={{ color: "#1a56db", fontWeight: 700 }}>
              ログイン画面へ
            </Link>
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}
            <label className="field">
              新しいパスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="field">
              新しいパスワード（確認）
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "処理中..." : "パスワードを再設定する"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
