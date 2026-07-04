"use client";
import { useState } from "react";

export default function WelcomeModal({ session, onDismiss }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    setClosing(true);
    await fetch("/api/auth/seen-intro", { method: "POST" });
    onDismiss();
  }

  const isDoctor = session.role === "doctor";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,27,51,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 480, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}
      >
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>
          {isDoctor ? "🩺 医師の方へ" : "🏥 病院の方へ"}
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          ご利用前に、DocLinkの仕組みを簡単にご案内します。
        </p>

        {isDoctor ? (
          <ul style={{ fontSize: 14, lineHeight: 1.9, paddingLeft: 20, margin: "0 0 16px" }}>
            <li>気になる求人があれば、<strong>病院と直接チャットでやり取り</strong>していただきます。</li>
            <li>チャットに返信があると、<strong>登録したメールアドレスに通知</strong>が届きます。</li>
            <li>
              DocLinkは仲介手数料を業界最安水準に抑えています。その分を<strong>医師の待遇に反映していただくよう病院側にお願い</strong>しています。
            </li>
          </ul>
        ) : (
          <ul style={{ fontSize: 14, lineHeight: 1.9, paddingLeft: 20, margin: "0 0 16px" }}>
            <li>ご応募・お問い合わせがあれば、<strong>医師と直接チャットでやり取り</strong>いただけます。</li>
            <li>チャットにメッセージが届くと、<strong>登録したメールアドレスに通知</strong>が届きます。</li>
            <li>
              DocLinkは仲介手数料を業界最安水準（成約時のみ・スポット5,000円／非常勤10,000円／常勤20,000円）に抑えています。その分を、ぜひ<strong>医師の待遇（給与・条件）に反映</strong>いただくようお願いします。医師の皆様にも、その旨をご案内しています。
            </li>
          </ul>
        )}

        <button className="btn-primary" style={{ width: "100%" }} onClick={handleClose} disabled={closing}>
          {closing ? "処理中..." : "了解しました"}
        </button>
      </div>
    </div>
  );
}
