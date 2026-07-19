import fs from "fs";
import path from "path";
import { marked } from "marked";

// Articles are plain markdown files in content/columns/, one per article,
// with a small frontmatter block. Adding an article = dropping a .md file
// there and redeploying — no DB, no admin UI, so non-engineers (e.g. whoever
// runs the SNS account) can author one in any text editor. The slug is the
// filename without extension and becomes the URL: /column/<slug>.
//
// Frontmatter format (--- delimited, key: value per line):
//   title:       required, the article's H1 and <title>
//   description: required, meta description / list-page summary (~120 chars)
//   date:        required, YYYY-MM-DD (publication date, newest first)
//   draft:       optional, "true" hides the article from the list, sitemap,
//                and direct access — lets a reviewer see it locally first
const CONTENT_DIR = path.join(process.cwd(), "content", "columns");

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

function loadColumn(filename) {
  const slug = filename.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  if (!meta.title || !meta.date) return null;
  return {
    slug,
    title: meta.title,
    description: meta.description || "",
    date: meta.date,
    draft: meta.draft === "true",
    body,
  };
}

export function listColumns() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(loadColumn)
    .filter((c) => c && !c.draft)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getColumn(slug) {
  // slug comes from the URL — path.basename guards against traversal the
  // same way lib/uploads.js does for stored filenames.
  const safe = path.basename(slug);
  const file = path.join(CONTENT_DIR, `${safe}.md`);
  if (!fs.existsSync(file)) return null;
  const col = loadColumn(`${safe}.md`);
  if (!col || col.draft) return null;
  return col;
}

export function renderColumnHtml(column) {
  return marked.parse(column.body);
}
