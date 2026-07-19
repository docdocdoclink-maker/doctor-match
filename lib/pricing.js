// 成約時の手数料は求人形態によって3段階。
// スポット（単発の当直・日直）が最も安く、常勤が最も高い。
export const FEE_BY_TYPE = {
  当直: 5000,
  日当直: 5000,
  スポット: 5000,
  非常勤: 10000,
  常勤: 20000,
};

export function getFeeForJobType(type) {
  return FEE_BY_TYPE[type] ?? 5000;
}

export function formatYen(amount) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

// Builds the display string for a posting's pay (job.pay_text) from the
// structured fields a hospital actually fills in — amount is entered in 万円
// (10,000-yen units) since typing "8" is easier than "80000".
export function buildPayText(unit, amountManYen, note) {
  const yen = Math.round(amountManYen * 10000);
  const trimmedNote = (note || "").trim();
  return `${unit}${formatYen(yen)}${trimmedNote ? `（${trimmedNote}）` : ""}`;
}

// Stripe Payment Links (hosted checkout URLs, not secret — safe to expose to the
// client). One link per fee tier, created manually in the Stripe dashboard.
// Set these in .env.local once the links exist; unset falls back to "準備中".
export const PAYMENT_LINK_BY_TYPE = {
  当直: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOT || "",
  日当直: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOT || "",
  スポット: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOT || "",
  非常勤: process.env.NEXT_PUBLIC_STRIPE_LINK_PARTTIME || "",
  常勤: process.env.NEXT_PUBLIC_STRIPE_LINK_FULLTIME || "",
};

export function getPaymentLinkForJobType(type) {
  return PAYMENT_LINK_BY_TYPE[type] || "";
}

// Permanent policy (replaces the old time-boxed launch campaign): a
// hospital's first billable hire is free, every hire after that is charged
// normally. `hospital` is a users row — pass the hospital account, not the
// job or conversation, since the allowance is scoped per hospital account
// and consumed once regardless of which job/doctor it's used on.
export function isFirstHireFree(hospital) {
  return !hospital?.first_hire_fee_waived_at;
}
