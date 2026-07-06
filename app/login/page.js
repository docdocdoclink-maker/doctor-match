"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Coming from the landing page with a role in mind ("?role=doctor" etc.)
  // almost always means the visitor doesn't have an account yet, so send
  // them straight to the registration flow instead.
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "doctor" || roleParam === "hospital") {
      router.replace(`/signup?role=${roleParam}`);
    }
  }, [searchParams, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
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
        <h1 style={{ fontSize: 18, margin: "0 0 16px" }}>ログイン</h1>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
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

          <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>

        <p className="fee-note" style={{ marginTop: 14, textAlign: "center" }}>
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" style={{ color: "#1a56db", fontWeight: 700 }}>
            会員登録
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
