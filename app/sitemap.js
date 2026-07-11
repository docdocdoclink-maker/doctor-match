import db from "@/lib/db";

// Next.js tries to prerender this route at build time by default, but the
// build container only ever has the in-memory placeholder DB (see
// lib/db.js) — no jobs table exists yet. Forcing this dynamic defers
// generation to request time, against the real volume-backed DB.
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function toIsoDate(sqliteText) {
  if (!sqliteText) return undefined;
  return new Date(sqliteText.replace(" ", "T") + "Z").toISOString();
}

export default function sitemap() {
  const jobs = db.prepare("SELECT id, confirmed_at, created_at FROM jobs WHERE closed = 0").all();

  const jobEntries = jobs.map((job) => ({
    url: `${APP_URL}/jobs/${job.id}`,
    lastModified: toIsoDate(job.confirmed_at || job.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: APP_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/jobs`, changeFrequency: "daily", priority: 0.9 },
    ...jobEntries,
  ];
}
