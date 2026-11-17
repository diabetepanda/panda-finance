// ui/steps/StepBasic.tsx｜步驟 ① 關於你（規格 Phase 5 第二節）
import type { FormState } from "../form";

export default function StepBasic({ form, set, ageErrors }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  ageErrors: string[];
}) {
  return (
    <div className="card"><div className="card-body">
      <div className="grid3">
        <div><label htmlFor="ageNow">你現在幾歲</label><input id="ageNow" type="number" inputMode="numeric" step="1" value={form.ageNow} onChange={(e) => set({ ageNow: e.target.value })} /></div>
        <div><label htmlFor="ageRetire">想幾歲退休</label><input id="ageRetire" type="number" inputMode="numeric" step="1" value={form.ageRetire} onChange={(e) => set({ ageRetire: e.target.value })} /></div>
        <div>
          <label htmlFor="initAssets">目前存款和投資，合計大約多少 <span className="unit-hint">（元）</span></label>
          <input id="initAssets" type="number" inputMode="decimal" step="any" value={form.initAssets} onChange={(e) => set({ initAssets: e.target.value })} />
          <p className="note">活存、定存、股票、基金都算，不含房子和勞退帳戶。</p>
        </div>
      </div>
      {ageErrors.length > 0 && <p className="msg show">{ageErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>}
      <details className="adv">
        <summary>進階</summary>
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="ageLife">預期壽命（歲）</label>
          <input id="ageLife" type="number" inputMode="numeric" step="1" value={form.ageLife} onChange={(e) => set({ ageLife: e.target.value })} />
          <p className="note">依內政部簡易生命表等公開資料設定（見 PARAMETERS.md）。設長一點比較保守。</p>
        </div>
      </details>
    </div></div>
  );
}
