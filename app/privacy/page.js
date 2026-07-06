import Link from "next/link";

export const metadata = { title: "プライバシーポリシー｜DocLink" };

export default function PrivacyPage() {
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <Link href="/" className="back-link">
        ← トップに戻る
      </Link>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>プライバシーポリシー</h1>
      <p className="fee-note" style={{ marginBottom: 24 }}>
        ※本ポリシーはプロトタイプ段階の暫定版です。正式サービスとして運用する前に、専門家によるレビューを受けることを想定しています。
      </p>

      <div style={{ fontSize: 14, lineHeight: 1.9, color: "#374151" }}>
        <Section title="第1条（事業者情報）">
          <p>
            DocLink（以下「本サービス」）は、個人事業として運営しています。本ポリシーに関するお問い合わせは、第9条の窓口までご連絡ください。
          </p>
        </Section>

        <Section title="第2条（取得する個人情報）">
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>メールアドレス、パスワード（ハッシュ化して保管し、運営者も含め誰も元のパスワードを閲覧できません）</li>
            <li>氏名または病院名</li>
            <li>医師登録の場合：医籍登録番号（任意）、専門医資格（任意）、履歴書・医師免許証の写し</li>
            <li>チャット機能を通じて送受信されるメッセージの内容</li>
          </ul>
        </Section>

        <Section title="第3条（利用目的）">
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>本人確認および利用登録の審査のため</li>
            <li>求人の掲載・閲覧、メッセージ機能など本サービスの提供のため</li>
            <li>チャットの新着通知など、登録メールアドレス宛の通知のため</li>
            <li>不正利用の防止、利用者からのお問い合わせ対応のため</li>
            <li>成約時の手数料請求事務のため</li>
          </ul>
        </Section>

        <Section title="第4条（第三者提供）">
          <p>
            履歴書・医師免許証の写しは本人確認の目的でのみ保管し、医師本人の同意なく病院その他の第三者に開示することはありません。専門医資格は、医師本人の入力により病院側に表示されます。法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供することはありません。
          </p>
        </Section>

        <Section title="第5条（外部サービスの利用）">
          <p>
            本サービスの提供にあたり、以下の外部サービスを利用しています。いずれも目的達成に必要な範囲でのみ情報を送信します。
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0 0" }}>
            <li>メール送信：Gmail（SMTP経由での通知メール配信）</li>
            <li>決済：Stripe（成約手数料のお支払い手続き）</li>
            <li>ホスティング：Railway（本サービスの稼働基盤）</li>
          </ul>
        </Section>

        <Section title="第6条（安全管理措置）">
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>パスワードはハッシュ化して保管しています</li>
            <li>通信はHTTPSにより暗号化されています</li>
            <li>
              履歴書・医師免許証は、本人及び本人確認を行う運営者のみアクセスできます。チャットのメッセージ内容・添付ファイルは、原則として本人及び取引の相手方のみがアクセスでき、運営者は、医師又は病院いずれかから相談の申請があった場合に限りアクセスします
            </li>
            <li>ログイン試行回数に制限を設け、不正なログイン試行を防止しています</li>
          </ul>
        </Section>

        <Section title="第7条（保有期間）">
          <p>
            取得した個人情報は、利用目的の達成に必要な期間保管します。退会後も、不正利用防止や法令上の必要がある場合には、合理的な期間保管することがあります。
          </p>
        </Section>

        <Section title="第8条（開示・訂正・利用停止等の請求）">
          <p>
            ご自身の個人情報の開示・訂正・削除・利用停止をご希望の場合は、第9条の窓口までご連絡ください。本人確認のうえ、合理的な期間内に対応いたします。
          </p>
        </Section>

        <Section title="第9条（お問い合わせ窓口）">
          <p>
            本ポリシーおよび個人情報の取り扱いに関するお問い合わせは、
            <Link href="/contact" style={{ color: "#1a56db", fontWeight: 700 }}>
              {" "}
              お問い合わせフォーム
            </Link>
            {" "}よりご連絡ください。
          </p>
        </Section>

        <Section title="第10条（本ポリシーの変更）">
          <p>
            運営者は、必要と判断した場合、本ポリシーを変更できるものとします。変更後の内容は、本サービス上に掲示した時点から効力を生じるものとします。
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>{title}</h2>
      {children}
    </section>
  );
}
