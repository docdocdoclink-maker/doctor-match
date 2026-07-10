// Fixed choices for job postings — shared by the posting form, the job
// search filters, and job alerts, so all three stay in sync. Deriving these
// from currently-live postings instead would mean an area/type disappears
// from the filter (and can't be picked for an alert) the moment nothing is
// posted for it, which defeats the point of an alert.
export const JOB_TYPES = ["非常勤", "当直", "日当直", "常勤"];

export const PREFECTURES = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県"];

// A doctor's own employment-style preference, shown to hospitals as part of
// their profile. Deliberately a simpler 3-way split than JOB_TYPES (which
// distinguishes 当直/日当直 for posting purposes) — from a doctor's
// perspective both are just "スポット" one-off shifts.
export const EMPLOYMENT_PREFERENCES = ["常勤", "非常勤", "スポット"];

// Job-alert matching criteria (see AlertPanel / broadcast-to-matching-doctors
// feature) — these describe the shift itself, separate from
// EMPLOYMENT_PREFERENCES which describes the doctor's overall contract-style
// preference.
export const SHIFT_TYPES = ["日勤", "当直", "スポット"];

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export const SKILLS = ["内視鏡", "エコー", "気管挿管", "中心静脈カテーテル", "縫合", "腰椎穿刺"];
