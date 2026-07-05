"use client";
import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "送信に失敗しました");
        setSending(false);
        return;
      }
      setSent(true);
    } catch (err) {
      setError("通信エラーが発生しました");
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="wrap-narrow">
        <Link href="/" className="brand" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
          DocLink <span className="badge">Prototype</span>
        </Link>
        <div className="card" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>お問い合わせありがとうございます</h1>
          <p style={{ fontSize: 14, color: "#4b5563" }}>
            内容を確認のうえ、ご入力いただいたメールアドレス宛にご連絡いたします。
          </p>
          <Link href="/" style={{ color: "#1a56db", fontWeight: 700 }}>
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap-narrow">
      <Link href="/" className="brand" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
        DocLink <span className="badge">Prototype</span>
      </Link>
      <div className="card">
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>お問い合わせ</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          DocLinkの運営に関するご質問・ご相談はこちらからお願いします。
        </p>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="field">
            お名前
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            メールアドレス
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            ご立場（任意）
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">選択してください</option>
              <option value="医師">医師</option>
              <option value="病院・医療機関">病院・医療機関</option>
              <option value="その他">その他</option>
            </select>
          </label>
          <label className="field">
            お問い合わせ内容
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ご質問・ご相談内容をご記入ください"
              required
            />
          </label>
          <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={sending}>
            {sending ? "送信中..." : "送信する"}
          </button>
        </form>
      </div>
    </div>
  );
}
