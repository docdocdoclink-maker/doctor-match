import fs from "fs";
import path from "path";

// The marketing landing page is a standalone static HTML file (not a React
// page) so it's served as-is via a route handler rather than app/page.js.
// It lives in public/ so this read never touches the volume-backed DATA_DIR.
export async function GET() {
  const html = fs.readFileSync(path.join(process.cwd(), "public", "landing.html"), "utf-8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
