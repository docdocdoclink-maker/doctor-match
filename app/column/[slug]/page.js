import Link from "next/link";
import { notFound } from "next/navigation";
import { getColumn, renderColumnHtml } from "@/lib/columns";

export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const column = getColumn(slug);
  if (!column) return { title: "記事が見つかりません｜DocLink" };

  const url = `${APP_URL}/column/${column.slug}`;
  return {
    title: `${column.title}｜DocLink`,
    description: column.description,
    alternates: { canonical: url },
    openGraph: {
      title: column.title,
      description: column.description,
      url,
      siteName: "DocLink",
      type: "article",
    },
  };
}

export default async function ColumnPage({ params }) {
  const { slug } = await params;
  const column = getColumn(slug);
  if (!column) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: column.title,
    description: column.description,
    datePublished: `${column.date}T00:00:00+09:00`,
    author: { "@type": "Organization", name: "DocLink" },
    publisher: { "@type": "Organization", name: "DocLink" },
    mainEntityOfPage: `${APP_URL}/column/${column.slug}`,
  };

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/column" className="back-link">
        ← コラム一覧に戻る
      </Link>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{column.date}</div>
      <h1 style={{ fontSize: 24, margin: "0 0 24px", lineHeight: 1.5 }}>{column.title}</h1>
      {/* Markdown authored by the site operator only (content/columns/ ships
          with the repo), so rendering it as HTML is trusted input — the same
          trust model as the JSX on any other page. */}
      <article
        className="column-body"
        style={{ fontSize: 15, lineHeight: 2, color: "#374151" }}
        dangerouslySetInnerHTML={{ __html: renderColumnHtml(column) }}
      />
      <div className="card" style={{ marginTop: 40, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          DocLinkは医師と病院が直接つながる求人サービスです
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          紹介会社を介さないため、医師は完全無料。当直・非常勤・常勤の求人を掲載しています。
        </p>
        <Link
          href="/jobs"
          style={{
            display: "inline-block",
            background: "#1a56db",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
            padding: "10px 24px",
            borderRadius: 8,
          }}
        >
          求人を見てみる
        </Link>
      </div>
    </div>
  );
}
