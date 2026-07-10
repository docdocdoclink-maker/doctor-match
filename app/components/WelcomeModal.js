"use client";
import { useState } from "react";
import { isFreeCampaignActive } from "../../lib/pricing";

// reopenable: true when opened on demand from the topbar's "使い方" link,
// after the user has already seen (and dismissed) this once. Skips the
// seen-intro POST — that flag is already set — and shows a plain "閉じる"
// instead of "了解しました", which only makes sense the first time.
export default function WelcomeModal({ session, onDismiss, reopened = false }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    setClosing(true);
    if (!reopened) await fetch("/api/auth/seen-intro", { method: "POST" });
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 0 16px" }}>
            <IntroItem icon="💬" title="病院と直接チャット">
              気になる求人があれば、病院と直接チャットでやり取りします。
            </IntroItem>
            <IntroItem icon="📧" title="メール通知">
              チャットに返信があると、登録したメールアドレスに通知が届きます。
            </IntroItem>
            <IntroItem icon="🔒" title="資格・書類の扱い">
              専門医資格は病院とやり取りを始めると表示されます（未入力なら非表示）。履歴書・医師免許証は本人確認のみに使い、共有をオンにしない限り病院には見えません。
            </IntroItem>
            <IntroItem icon="🟢" title="「求職中」トグル">
              オンの間だけ病院から新規メッセージ（お声がけ）を受け取れます。オフで一時停止できますが、ご自身から送るのは常に可能です。
            </IntroItem>
            <IntroItem icon="💰" title="業界最安水準の手数料">
              その分を、医師の待遇に反映していただくよう病院側にお願いしています。
            </IntroItem>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 0 16px" }}>
            <IntroItem icon="💬" title="医師と直接チャット">
              ご応募・お問い合わせがあれば、医師と直接チャットでやり取りいただけます。
            </IntroItem>
            <IntroItem icon="📧" title="メール通知">
              チャットにメッセージが届くと、登録したメールアドレスに通知が届きます。
            </IntroItem>
            <IntroItem icon="💰" title="業界最安水準の手数料">
              成約時のみ・スポット5,000円／非常勤10,000円／常勤20,000円。
              {isFreeCampaignActive() && (
                <> 今年度中（2027年3月31日まで）はキャンペーンとしてこの手数料も無料です。</>
              )}
              {" "}その分を、ぜひ医師の待遇（給与・条件）に反映いただくようお願いします。
            </IntroItem>
          </div>
        )}

        <button className="btn-primary" style={{ width: "100%" }} onClick={handleClose} disabled={closing}>
          {closing ? "処理中..." : reopened ? "閉じる" : "了解しました"}
        </button>
      </div>
    </div>
  );
}

function IntroItem({ icon, title, children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ fontSize: 18, lineHeight: "22px" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0d1b33", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}
