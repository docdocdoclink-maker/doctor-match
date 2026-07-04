// 成約時の手数料は求人形態によって3段階。
// スポット（単発の当直・日直）が最も安く、常勤が最も高い。
export const FEE_BY_TYPE = {
  当直: 5000,
  日当直: 5000,
  非常勤: 10000,
  常勤: 20000,
};

export function getFeeForJobType(type) {
  return FEE_BY_TYPE[type] ?? 5000;
}

export function formatYen(amount) {
  return `${amount.toLocaleString("ja-JP")}円`;
}

// Stripe Payment Links (hosted checkout URLs, not secret — safe to expose to the
// client). One link per fee tier, created manually in the Stripe dashboard.
// Set these in .env.local once the links exist; unset falls back to "準備中".
export const PAYMENT_LINK_BY_TYPE = {
  当直: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOT || "",
  日当直: process.env.NEXT_PUBLIC_STRIPE_LINK_SPOT || "",
  非常勤: process.env.NEXT_PUBLIC_STRIPE_LINK_PARTTIME || "",
  常勤: process.env.NEXT_PUBLIC_STRIPE_LINK_FULLTIME || "",
};

export function getPaymentLinkForJobType(type) {
  return PAYMENT_LINK_BY_TYPE[type] || "";
}
