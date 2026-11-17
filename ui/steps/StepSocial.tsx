// ui/steps/StepSocial.tsx｜步驟 ③ 勞保勞退與其他收入（規格 Phase 5 第四節）
// 估算數字全部呼叫 core/socialEstimate.ts，元件裡不重算。
import type { FormState, Computed } from "../form";
import { num } from "../form";
import {
  estimateExistingYears, wageBasis, estimateInsuredSalary, estimateLrWage,
  estimateLrBalance, validateSocialChoice,
} from "../../core/socialEstimate";
import { laborPensionMonthlyEligibilityWarning } from "../../core/social";
import { socialParamValue } from "../../config/social";
import { paramDef } from "../../config/defaults";
import { sumOtherRetireIncome } from "../../core/otherIncome";
import { fmtPlain } from "../format";
import HowToCheck from "../components/HowToCheck";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function StepSocial({ form, set, inp, computed, howToOpen, setHowToOpen }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  inp: import("../../core/simulate").SimInput;
  computed: Computed | null;
  howToOpen: boolean;
  setHowToOpen: (open: boolean) => void;
}) {
  const choice = form.laborInsured;
  const estimateMode = choice === "unsure" || form.socialInputMode === "estimate";
  const grossNum = form.grossSalary.trim() === "" ? NaN : num(form.grossSalary);
  const basis = wageBasis(grossNum, num(form.monthlyIncome));
  const estYears = estimateExistingYears(num(form.ageNow), num(form.startWorkAge));
  const estLiSalary = estimateInsuredSalary(basis);
  const estLrWage = form.lrWageManual ? num(form.lrWage) : estimateLrWage(basis);
  const estBalance = estimateLrBalance(estYears, estLrWage, num(form.lrEmployerRate));
  const existingForMode = estimateMode ? estYears : num(form.liExistingYears);
  const choiceMsgs = validateSocialChoice({ ageNow: num(form.ageNow), startWorkAge: num(form.startWorkAge), grossSalary: grossNum });
  const detail = computed?.res.socialDetail ?? null;

  const seedManual = () => set({
    socialInputMode: "manual",
    liExistingYears: String(estYears),
    liAvgSalary: String(estLiSalary), liSalaryManual: true,
    lrBalance: String(Math.round(estBalance)),
  });

  return (
    <div className="card"><div className="card-body">
      <label style={{ marginTop: 6 }}>你有在保勞保嗎？</label>
      <div className="seg" role="group" aria-label="你有在保勞保嗎">
        <button type="button" aria-pressed={choice === "yes"} onClick={() => set({ laborInsured: "yes" })}>有</button>
        <button type="button" aria-pressed={choice === "no"} onClick={() => set({ laborInsured: "no" })}>沒有</button>
        <button type="button" aria-pressed={choice === "unsure"} onClick={() => set({ laborInsured: "unsure" })}>不確定</button>
      </div>
      <p className="note">在公司、工廠、店家上班，或透過職業工會加保，通常都有勞保。公教人員、軍人有自己的退休制度，不是勞保。</p>

      {choice === "no" && (
        <p className="soft-hint show">沒有勞保的話，這裡不會計算勞保和勞退。公教或軍職退休金、國民年金等，可以填在下面的『其他退休收入』。國民年金本站不計算，可用勞保局的 <a href="https://www.bli.gov.tw/0100754.html" {...ext}>國民年金老年年金試算（勞保局，免登入）</a>。</p>
      )}

      {choice !== "no" && (
        <>
          <p className="note">勞保、勞退制度參數已依勞動部勞工保險局、全國法規資料庫公告核對（查證日 2026-11-17）；勞退基金收益率、年金打折等為假設值。法規可能變動，請以主管機關最新公告為準。</p>
          {choice === "unsure" && (
            <p className="soft-hint show">不確定也沒關係，先用估的。查到正確資料後，把上面改成『有』再自己填。</p>
          )}

          {estimateMode ? (
            <>
              <div className="grid2">
                <div>
                  <label htmlFor="startWorkAge">你幾歲開始做全職工作</label>
                  <input id="startWorkAge" type="number" inputMode="numeric" step="1" value={form.startWorkAge} onChange={(e) => set({ startWorkAge: e.target.value })} />
                  <p className="note">範例：30 歲剛開始工作，所以目前勞保年資是 0 年。中間有一段時間沒工作的話，可以把開始年齡往後調。</p>
                </div>
                <div>
                  <label htmlFor="grossSalary">稅前月薪（選填） <span className="unit-hint">（元）</span></label>
                  <input id="grossSalary" type="number" inputMode="decimal" step="any" value={form.grossSalary} onChange={(e) => set({ grossSalary: e.target.value })} />
                  <p className="note">薪資單上扣款前的月薪。空白的話，就先用實領薪水來估。</p>
                </div>
              </div>
              {choiceMsgs.length > 0 && <p className="msg show">{choiceMsgs.map((m, i) => <span key={i}>{m}<br /></span>)}</p>}
              <p className="note" aria-live="polite">依你的回答估計：目前勞保年資約 {fmtPlain(estYears)} 年、勞保投保薪資 {fmtPlain(estLiSalary)} 元、勞退提繳薪資 {fmtPlain(estLrWage)} 元、勞退帳戶目前約 {fmtPlain(Math.round(estBalance))} 元（只算本金，沒有算收益，所以偏保守）。</p>
            </>
          ) : (
            <>
              <div className="grid2">
                <div><label htmlFor="liYears">目前勞保年資（年）</label><input id="liYears" type="number" inputMode="decimal" step="any" value={form.liExistingYears} onChange={(e) => set({ liExistingYears: e.target.value })} /></div>
                <div>
                  <label htmlFor="liSalary">最高 60 個月平均投保薪資（勞保） <span className="unit-hint">（元）</span></label>
                  <input id="liSalary" type="number" inputMode="decimal" step="any" value={form.liAvgSalary} onChange={(e) => set({ liAvgSalary: e.target.value, liSalaryManual: true })} />
                  <p className="note">勞保局資料上通常看得到每次投保薪資的調整；不確定的話先填目前的投保薪資。上限 {fmtPlain(socialParamValue("liSalaryCap"))} 元。</p>
                </div>
                <div><label htmlFor="lrBal">勞退個人帳戶目前累積 <span className="unit-hint">（元）</span></label><input id="lrBal" type="number" inputMode="decimal" step="any" value={form.lrBalance} onChange={(e) => set({ lrBalance: e.target.value })} /></div>
                <div><label htmlFor="lrSelf">勞退自提率（%，0–{socialParamValue("lrEmployeeMaxRate")}）</label><input id="lrSelf" type="number" inputMode="decimal" step="any" value={form.lrEmployeeRate} onChange={(e) => set({ lrEmployeeRate: e.target.value })} /></div>
              </div>
              {num(form.lrEmployeeRate) > 0 && (
                <p className="note"><b>月收入請填扣掉勞退自提之後的實領金額</b>，自提部分會另外算進勞退帳戶，不會再從收入扣一次。</p>
              )}
            </>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start", marginTop: 10 }}>
            {choice === "yes" && (
              estimateMode ? (
                <button type="button" className="ghost small" onClick={seedManual}>我查得到，自己填</button>
              ) : (
                <button type="button" className="ghost small" onClick={() => set({ socialInputMode: "estimate" })}>改回用估的</button>
              )
            )}
          </div>
          <HowToCheck open={howToOpen} onToggle={setHowToOpen} />

          <details className="adv">
            <summary>進階</summary>
            <h3 style={{ margin: "10px 0 6px" }}>勞保老年年金</h3>
            <div className="grid3">
              <div>
                <label htmlFor="liPlanned">預計投保年資（年）</label>
                <input id="liPlanned" type="number" inputMode="decimal" step="any"
                  value={form.liPlannedManual ? form.liPlannedYears : String(existingForMode + Math.max(0, num(form.ageRetire) - num(form.ageNow)))}
                  onChange={(e) => set({ liPlannedYears: e.target.value, liPlannedManual: true })} />
                {form.liPlannedManual && <button type="button" className="ghost small" onClick={() => set({ liPlannedManual: false, liPlannedYears: "" })}>恢復自動（已有年資＋工作年數）</button>}
              </div>
              <div><label htmlFor="liClaim">請領年齡（歲）</label><input id="liClaim" type="number" inputMode="numeric" step="1" value={form.liClaimAge} onChange={(e) => set({ liClaimAge: e.target.value })} /></div>
              <div>
                <label htmlFor="liDiscount">年金給付打折（%）<span className="unit-hint">模擬勞保財務風險</span></label>
                <input id="liDiscount" type="range" min="0" max="50" step="1" value={form.liDiscount} onChange={(e) => set({ liDiscount: e.target.value })} />
                <span>{form.liDiscount}%</span>
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <input type="checkbox" checked={form.liIndexed} onChange={(e) => set({ liIndexed: e.target.checked })} />
              勞保年金會跟著物價調整
            </label>
            <h3 style={{ margin: "14px 0 6px" }}>勞退新制</h3>
            <div className="grid3">
              <div>
                <label htmlFor="lrWage">勞退提繳薪資 <span className="unit-hint">（元）</span></label>
                <input id="lrWage" type="number" inputMode="decimal" step="any"
                  value={form.lrWageManual ? form.lrWage : String(estimateLrWage(basis))}
                  onChange={(e) => set({ lrWage: e.target.value, lrWageManual: true })} />
                {form.lrWageManual && <button type="button" className="ghost small" onClick={() => set({ lrWageManual: false, lrWage: "" })}>恢復依月薪級距</button>}
                <p className="note">上限 {fmtPlain(socialParamValue("lrWageCap"))} 元（假設參數），上限不隨通膨調整。</p>
              </div>
              <div><label htmlFor="lrEmp">雇主提繳率（%）</label><input id="lrEmp" type="number" inputMode="decimal" step="any" value={form.lrEmployerRate} onChange={(e) => set({ lrEmployerRate: e.target.value })} /></div>
              <div><label htmlFor="lrFund">勞退基金每年收益率（假設值） <span className="unit-hint">（%／年）</span></label><input id="lrFund" type="number" inputMode="decimal" step="any" value={form.lrFundReturn} onChange={(e) => set({ lrFundReturn: e.target.value })} /></div>
              <div><label htmlFor="lrClaim">勞退法定請領年齡（歲，假設參數）</label><input id="lrClaim" type="number" inputMode="numeric" step="1" value={form.lrClaimAge} onChange={(e) => set({ lrClaimAge: e.target.value })} /></div>
              <div>
                <label>請領方式</label>
                <div className="seg" role="group" aria-label="勞退請領方式">
                  <button type="button" aria-pressed={form.lrMode === "lump"} onClick={() => set({ lrMode: "lump" })}>一次領</button>
                  <button type="button" aria-pressed={form.lrMode === "monthly"} onClick={() => set({ lrMode: "monthly" })}>月領</button>
                </div>
              </div>
            </div>
          </details>

          {detail && detail.liYears < socialParamValue("liMinYears") && (
            <p className="soft-hint show">年資可能不符合請領年金的條件（目前假設參數：需 {socialParamValue("liMinYears")} 年以上），請自行確認；下方仍顯示試算值，但不一定符合資格。</p>
          )}
          {inp.social && laborPensionMonthlyEligibilityWarning(inp.social.laborPension, inp.ageNow, inp.ageRetire) && (
            <p className="note">勞退提繳年資未滿 15 年，依規定只能一次領，以下月領金額僅供參考。（年資以現在到退休的年數近似，實際以勞保局紀錄為準。）</p>
          )}
          {inp.social && inp.ageRetire < num(form.lrClaimAge) && (
            <p className="note">勞退個人帳戶通常需到法定年齡才能請領，退休到請領之間的支出會由你的資產支應。</p>
          )}
          {detail && (
            <>
              <p className="note">試算：預計年資 {detail.liYears} 年，勞保月領（今日幣值，調整與打折後）約 {fmtPlain(Math.round(detail.liMonthlyToday))} 元。</p>
              <p className="note">試算：退休時勞退帳戶約 {fmtPlain(Math.round(detail.lpBalance))} 元（今日幣值），{detail.lpStartAge} 歲起領{form.lrMode === "monthly" ? `，月領約 ${fmtPlain(Math.round(detail.lpMonthlyAnnual / 12))} 元／月（以基金實質收益率年金化、領到預期壽命的簡化）` : detail.lpStartAge > inp.ageRetire ? `，一次領於 ${detail.lpStartAge} 歲併入資產（空窗期續以基金收益率累積）` : "，一次領併入退休時資產"}。勞退提領課稅不納入計算；健保費等請自行反映在退休支出中。</p>
            </>
          )}
        </>
      )}

      <h3 style={{ margin: "18px 0 6px" }}>其他退休收入（勞保、勞退以外）</h3>
      <div style={{ maxWidth: 340 }}>
        <label htmlFor="otherRetireIncome">其他退休收入 <span className="unit-hint">（元／月，今日幣值，選填）</span></label>
        <input id="otherRetireIncome" type="number" inputMode="decimal" step="any" value={form.otherRetireIncome} onChange={(e) => set({ otherRetireIncome: e.target.value })} />
      </div>
      <p className="note">{paramDef("otherRetireIncome").note}</p>
      <details className="no-print">
        <summary style={{ cursor: "pointer", fontSize: ".92rem" }}>幫我估（把三項加總填入）</summary>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div><label htmlFor="oiRent">租金淨收入 <span className="unit-hint">（元／月，扣掉稅、管理費、修繕）</span></label><input id="oiRent" type="number" inputMode="decimal" step="any" value={form.otherRent} onChange={(e) => set({ otherRent: e.target.value })} /></div>
          <div><label htmlFor="oiAnn">年金險每月給付 <span className="unit-hint">（元／月）</span></label><input id="oiAnn" type="number" inputMode="decimal" step="any" value={form.otherAnnuity} onChange={(e) => set({ otherAnnuity: e.target.value })} /></div>
          <div><label htmlFor="oiPart">退休後兼職收入 <span className="unit-hint">（元／月）</span></label><input id="oiPart" type="number" inputMode="decimal" step="any" value={form.otherPartTime} onChange={(e) => set({ otherPartTime: e.target.value })} /></div>
        </div>
        <p className="note">合計 {fmtPlain(sumOtherRetireIncome({ rentNet: num(form.otherRent), annuity: num(form.otherAnnuity), partTime: num(form.otherPartTime) }))} 元／月（負數或空白當 0）。
          <button type="button" className="ghost small" style={{ marginLeft: 8 }}
            onClick={() => set({ otherRetireIncome: String(sumOtherRetireIncome({ rentNet: num(form.otherRent), annuity: num(form.otherAnnuity), partTime: num(form.otherPartTime) })) })}>
            填入「其他退休收入」
          </button>
        </p>
      </details>
    </div></div>
  );
}
