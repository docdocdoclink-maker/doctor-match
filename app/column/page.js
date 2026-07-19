import Link from "next/link";
import { listColumns } from "@/lib/columns";

// Reads the content directory on each request rather than prerendering at
// build time — same reasoning as sitemap.js: keeps behavior identical across
// the build container and the runtime container, and a redeploy with a new
// .md file Just Works without cache invalidation questions.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "医師の働き方コラム｜DocLink",
  description:
    "当直・非常勤バイトの実用情報や、医師紹介会社の手数料の仕組みなど、現役医師が運営するDocLinkが医師の働き方に役立つ情報をお届けします。",
};

export default function ColumnListPage() {
  const columns = listColumns();

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <Link href="/" className="back-link">
        ← トップに戻る
      </Link>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>医師の働き方コラム</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        当直・非常勤バイトの実用情報や、医師紹介の仕組みについて、現役医師の視点で解説します。
      </p>

      {columns.length === 0 ? (
        <p style={{ fontSize: 14, color: "#6b7280" }}>記事は準備中です。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {columns.map((c) => (
            <Link
              key={c.slug}
              href={`/column/${c.slug}`}
              className="card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{c.date}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#16202e", marginBottom: 6 }}>
                {c.title}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>{c.description}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
