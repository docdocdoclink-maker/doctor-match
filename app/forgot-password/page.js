"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="wrap-narrow">
      <Link href="/" className="brand" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
        DocLink <span className="badge">Prototype</span>
      </Link>
      <div className="card">
        <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>パスワードをお忘れの方</h1>

        {sent ? (
          <p className="fee-note">
            ご入力いただいたメールアドレス宛に、パスワード再設定用のリンクをお送りしました（該当するアカウントが存在する場合のみ届きます）。メールが届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
        ) : (
          <>
            <p className="fee-note" style={{ marginTop: 0 }}>
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <form onSubmit={handleSubmit}>
              <label className="field">
                メールアドレス
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "送信中..." : "再設定リンクを送る"}
              </button>
            </form>
          </>
        )}

        <p className="fee-note" style={{ marginTop: 14, textAlign: "center" }}>
          <Link href="/login" style={{ color: "#1a56db", fontWeight: 700 }}>
            ログイン画面に戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
