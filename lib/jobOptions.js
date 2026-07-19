// Fixed choices for job postings — shared by the posting form, the job
// search filters, and job alerts, so all three stay in sync. Deriving these
// from currently-live postings instead would mean an area/type disappears
// from the filter (and can't be picked for an alert) the moment nothing is
// posted for it, which defeats the point of an alert.
export const JOB_TYPES = ["非常勤", "当直", "日当直", "常勤", "スポット"];

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// Pay unit for a posting's amount (see lib/pricing.js buildPayText). Fixed
// list because the display string and any future amount-based comparisons
// (e.g. normalizing 月給 to a daily-equivalent) depend on knowing which of
// these it is — free text here would defeat the point of having a
// structured amount at all.
export const PAY_UNITS = ["日当", "月給", "時給", "年俸"];

// A doctor's own employment-style preference, shown to hospitals as part of
// their profile. Deliberately a simpler 3-way split than JOB_TYPES (which
// distinguishes 当直/日当直/スポット for posting purposes) — from a doctor's
// perspective all three are just "スポット" one-off shifts.
export const EMPLOYMENT_PREFERENCES = ["常勤", "非常勤", "スポット"];

// Job-alert matching criteria (see AlertPanel / broadcast-to-matching-doctors
// feature) — these describe the shift itself, separate from
// EMPLOYMENT_PREFERENCES which describes the doctor's overall contract-style
// preference.
export const SHIFT_TYPES = ["日勤", "当直", "スポット"];

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export const SKILLS = ["内視鏡", "エコー", "気管挿管", "中心静脈カテーテル", "縫合", "腰椎穿刺"];
