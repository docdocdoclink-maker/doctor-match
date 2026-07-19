import db from "@/lib/db";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// employmentType is a fixed schema.org enum, distinct from our own free-form
// JOB_TYPES labels — this just maps our label to the closest match.
const SCHEMA_EMPLOYMENT_TYPE = {
  常勤: "FULL_TIME",
  非常勤: "PART_TIME",
  当直: "CONTRACTOR",
  日当直: "CONTRACTOR",
  スポット: "CONTRACTOR",
};

// schema.org unitText values for baseSalary, from our pay_unit labels. Jobs
// whose rows predate the pay_unit column have no reliable unit — those omit
// baseSalary entirely rather than guess (a wrong salary period is worse for
// a doctor scanning Google's job results than no salary at all).
const SCHEMA_SALARY_UNIT = {
  日当: "DAY",
  月給: "MONTH",
  時給: "HOUR",
  年俸: "YEAR",
};

function toIsoDate(sqliteText) {
  if (!sqliteText) return undefined;
  return new Date(sqliteText.replace(" ", "T") + "Z").toISOString();
}

// generateMetadata/JSON-LD both need the job row, but this runs server-side
// against a synchronous SQLite handle — querying twice here is cheap and
// keeps the two concerns (metadata vs. structured data) independent.
function getJob(id) {
  return db.prepare("SELECT * FROM jobs WHERE id = ? AND closed = 0").get(id);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) {
    return { title: "求人が見つかりません | DocLink" };
  }

  const title = `${job.title}（${job.hospital_name}・${job.area}） | DocLink`;
  const description = `${job.hospital_name}（${job.area}・${job.dept}）の${job.type}求人。${job.date_text}／${job.pay_text}。医師と病院が直接やり取りできる求人情報提供サービスDocLinkに掲載中です。`;
  const url = `${APP_URL}/jobs/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "DocLink", type: "website" },
  };
}

export default async function JobLayout({ children, params }) {
  const { id } = await params;
  const job = getJob(id);

  // A one-day posting stops being valid once its work date has passed;
  // standing/recurring postings (work_date_ongoing) have no natural expiry,
  // so they omit validThrough and stay live until the hospital closes them.
  const validThrough =
    job && !job.work_date_ongoing && job.work_date
      ? `${job.work_date}T23:59:59+09:00`
      : undefined;
  const salaryUnit = job && SCHEMA_SALARY_UNIT[job.pay_unit];

  const jsonLd = job && {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.desc,
    identifier: {
      "@type": "PropertyValue",
      name: "DocLink",
      value: String(job.id),
    },
    datePosted: toIsoDate(job.created_at),
    ...(validThrough && { validThrough }),
    employmentType: SCHEMA_EMPLOYMENT_TYPE[job.type] || "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      name: job.hospital_name,
      ...(job.hospital_website && { sameAs: job.hospital_website }),
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.city && { addressLocality: job.city }),
        addressRegion: job.area,
        addressCountry: "JP",
      },
    },
    // Applying happens on this page itself (signup + chat), not via a
    // separate ATS redirect.
    directApply: true,
    ...(job.pay_amount != null &&
      salaryUnit && {
        baseSalary: {
          "@type": "MonetaryAmount",
          currency: "JPY",
          value: {
            "@type": "QuantitativeValue",
            value: job.pay_amount * 10000,
            unitText: salaryUnit,
          },
        },
      }),
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
           
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
