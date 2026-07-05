import Link from "next/link";

export default function ComingSoonPage() {
  return (
    <main className="wrap-narrow" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>
        DocLink <span className="badge">Prototype</span>
      </h1>
      <p style={{ color: "#4b5563", fontSize: 15 }}>
        現在準備中です。公開まで今しばらくお待ちください。
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/contact" style={{ color: "#1a56db", fontWeight: 700 }}>
          運営へのお問い合わせはこちら
        </Link>
      </p>
    </main>
  );
}
