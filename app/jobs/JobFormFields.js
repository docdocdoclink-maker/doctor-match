import { DEPT_CATEGORIES } from "../../lib/depts";
import { JOB_TYPES, PREFECTURES } from "../../lib/jobOptions";
import { getFeeForJobType, formatYen, isFreeCampaignActive } from "../../lib/pricing";

// Shared field set for both "post a new job" and "edit an existing job" —
// the two forms are otherwise identical, only the submit action differs.
export default function JobFormFields({ form, update }) {
  return (
    <>
      <label className="field">
        タイトル
        <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="例）土曜日当直医募集" required />
      </label>
      <label className="field">
        形態
        <select value={form.type} onChange={(e) => update("type", e.target.value)}>
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="fee-note" style={{ margin: "4px 0 0" }}>
          {isFreeCampaignActive() ? (
            <>成約時の手数料: 0円（今年度中キャンペーン中・通常{formatYen(getFeeForJobType(form.type))}）</>
          ) : (
            <>成約時の手数料: {formatYen(getFeeForJobType(form.type))}</>
          )}
        </span>
      </label>
      <label className="field">
        エリア
        <select value={form.area} onChange={(e) => update("area", e.target.value)}>
          {PREFECTURES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        市区町村（任意）
        <input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="例）千葉市中央区" />
        <span className="fee-note" style={{ margin: "4px 0 0" }}>
          求人一覧で市区町村での絞り込みに使われます。空欄のままだと都道府県全体の検索に含まれます。
        </span>
      </label>
      <label className="field">
        アクセス（最寄駅など・任意）
        <input value={form.access} onChange={(e) => update("access", e.target.value)} placeholder="例）JR〇〇駅から徒歩5分" />
      </label>
      <label className="field">
        診療科
        <select value={form.dept} onChange={(e) => update("dept", e.target.value)}>
          {DEPT_CATEGORIES.map((cat) => (
            <optgroup key={cat.group} label={cat.group}>
              {cat.depts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        日時
        <input
          value={form.dateText}
          onChange={(e) => update("dateText", e.target.value)}
          placeholder={
            form.workDateOngoing ? "例）毎週金曜 17:00〜翌9:00" : "例）2026/07/12(土) 17:00〜翌9:00"
          }
          required={!form.workDateOngoing}
        />
      </label>
      <label className="field">
        勤務日（並び替え用）
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563", margin: "2px 0 6px" }}>
          <input
            type="checkbox"
            checked={form.workDateOngoing}
            onChange={(e) => update("workDateOngoing", e.target.checked)}
          />
          随時・継続的に募集中（毎週◯曜日など、特定の1日に決まらない）
        </label>
        {!form.workDateOngoing && (
          <input type="date" value={form.workDate} onChange={(e) => update("workDate", e.target.value)} required />
        )}
        <span className="fee-note" style={{ margin: "4px 0 0" }}>
          求人一覧の「勤務日が近い順」の並び替えに使われます。上の「日時」とは別に、開始日を1つ指定してください。繰り返し勤務などで特定の1日に決まらない場合は、上のチェックを入れると常に「近い」扱いになります。
        </span>
      </label>
      <label className="field">
        報酬
        <input value={form.payText} onChange={(e) => update("payText", e.target.value)} placeholder="例）日当 60,000円" required />
      </label>
      <label className="field">
        報酬額（万円・並び替え用）
        <input
          type="number"
          min="0"
          step="0.1"
          value={form.payAmount}
          onChange={(e) => update("payAmount", e.target.value)}
          placeholder="例）6"
          required
        />
        <span className="fee-note" style={{ margin: "4px 0 0" }}>
          求人一覧の「報酬が高い順」の並び替えに使われます。上の「報酬」とは別に、金額を万円単位の数値で入力してください（例：日当6万円なら「6」）。
        </span>
      </label>
      <label className="field">
        業務内容
        <textarea value={form.desc} onChange={(e) => update("desc", e.target.value)} placeholder="業務内容を記載してください" required />
      </label>

      <div style={{ borderTop: "1px solid #eee", margin: "18px 0 14px", paddingTop: 14 }}>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
          以下は任意項目です。当直の実態が伝わると、医師が応募を判断しやすくなります。
        </p>
      </div>
      <label className="field">
        外来患者数の目安（任意）
        <input
          value={form.outpatientVolume}
          onChange={(e) => update("outpatientVolume", e.target.value)}
          placeholder="例）1日あたり30人程度"
        />
      </label>
      <label className="field">
        救急車搬送件数の目安（任意）
        <input
          value={form.emergencyVolume}
          onChange={(e) => update("emergencyVolume", e.target.value)}
          placeholder="例）年間2,000件"
        />
      </label>
      <label className="field">
        当直体制の概要（任意）
        <input
          value={form.nightDutyNote}
          onChange={(e) => update("nightDutyNote", e.target.value)}
          placeholder="例）整形外科医1名＋救急医常駐"
        />
      </label>
      <label className="field">
        バックアップ体制（任意）
        <input
          value={form.backupNote}
          onChange={(e) => update("backupNote", e.target.value)}
          placeholder="例）オンコールで常勤医に相談可"
        />
      </label>
      <label className="field">
        病院公式サイトURL（任意）
        <input
          type="url"
          value={form.hospitalWebsite}
          onChange={(e) => update("hospitalWebsite", e.target.value)}
          placeholder="例）https://example-hospital.jp"
        />
      </label>
    </>
  );
}
