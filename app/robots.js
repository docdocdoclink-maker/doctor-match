const APP_URL = process.env.APP_URL || "http://localhost:3000";

// Nothing is worth indexing before launch — SITE_LOCKED bounces every
// non-admin request to /coming-soon anyway (see proxy.js), so a crawler
// would just index that page under every URL. Once SITE_LOCKED=false in
// production, this switches to the real allow/disallow rules below.
export default function robots() {
  if (process.env.SITE_LOCKED !== "false") {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/jobs", "/jobs/*"],
      disallow: ["/jobs/new", "/jobs/*/edit", "/account", "/admin", "/inbox", "/api"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
