import db from "@/lib/db";

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
