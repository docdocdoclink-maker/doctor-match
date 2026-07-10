// Fixed choices for job postings — shared by the posting form, the job
// search filters, and job alerts, so all three stay in sync. Deriving these
// from currently-live postings instead would mean an area/type disappears
// from the filter (and can't be picked for an alert) the moment nothing is
// posted for it, which defeats the point of an alert.
export const JOB_TYPES = ["非常勤", "当直", "日当直", "常勤"];

export const PREFECTURES = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県"];
