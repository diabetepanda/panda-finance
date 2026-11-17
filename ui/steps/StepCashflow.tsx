// ui/steps/StepCashflow.tsx｜步驟 ② 每個月的錢（規格 Phase 5 第三節）
import type { FormState, LifeGoalRow } from "../form";
import { num } from "../form";
import { defaultRetireSpend, salaryRealGrowthNote } from "./stepHelpers";
import { paramValue, LIFE_GOAL_PRESETS } from "../../config/defaults";
import { goalCardSummary, goalShortfallWarnings, type LifeGoal } from "../../core/lifeGoals";
import { fmtPlain, fmtPct } from "../format";
import type { CategoryId } from "../../config/categories";
import type { SimInput } from "../../core/simulate";

export default function StepCashflow({ form, set, inp, incomeErrors }: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  inp: SimInput;
  incomeErrors: string[];
}) {
  const totalExpNow = form.expenses.reduce((s, e) => s + (Number.isFinite(num(e.amount)) ? num(e.amount) : 0), 0);
  const balanceNow = num(form.monthlyIncome) - totalExpNow;
  const ratio = paramValue("retireSpendRatio");
  const setExpense = (i: number, patch: Partial<FormState["expenses"][number]>) =>
    set({ expenses: form.expenses.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const shortfallWarnings = goalShortfallWarnings(inp);

  return (
    <div className="card"><div className="card-body">
      <div style={{ maxWidth: 340 }}>
        <label htmlFor="monthlyIncome">每月實領薪水 <span className="unit-hint">（元）</span></label>
        <input id="monthlyIncome" type="number" inputMode="decimal" step="any" value={form.monthlyIncome} onChange={(e) => set({ monthlyIncome: e.target.value })} />
        <p className="note">扣掉勞健保、所得稅、勞退自提之後，實際匯進戶頭的金額。</p>
      </div>

      <h3 style={{ margin: "16px 0 6px" }}>每月支出</h3>
      {form.expenses.map((e, i) => (
        <div className="expense-row" key={i}>
          <input type="text" className="exp-name" aria-label="支出項目名稱" value={e.name} onChange={(ev) => setExpense(i, { name: ev.target.value })} />
          <input type="number" className="exp-amount" aria-label="每月金額（元）" inputMode="decimal" step="any" value={e.amount} onChange={(ev) => setExpense(i, { amount: ev.target.value })} />
          {form.showExpenseEndAge && (
            <input type="number" className="exp-end" aria-label="到幾歲結束" inputMode="numeric" step="1" placeholder="到幾歲結束" value={e.endAge} onChange={(ev) => setExpense(i, { endAge: ev.target.value })} />
          )}
          <button type="button" className="del" aria-label="刪除此支出項目" onClick={() => set({ expenses: form.expenses.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ghost small" onClick={() => set({ expenses: [...form.expenses, { name: "新項目", amount: "0", endAge: "", category: "other" as CategoryId }] })}>＋ 新增支出項目</button>
      </div>
      {incomeErrors.length > 0 && <p className="msg show">{incomeErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>}
      <div className="totals" aria-live="polite">
        <div><span>每月支出合計</span><b>{fmtPlain(totalExpNow)} 元</b></div>
        <div><span>每月結餘</span><b>{fmtPlain(balanceNow)} 元</b></div>
        <div><span>儲蓄率</span><b>{num(form.monthlyIncome) > 0 ? fmtPct(balanceNow / num(form.monthlyIncome)) : "—"}</b></div>
      </div>
      {balanceNow < 0 && <p className="soft-hint show">目前每月支出高於收入，下面的試算會把這個缺口一併計入。</p>}

      <div style={{ maxWidth: 340, marginTop: 14 }}>
        <label htmlFor="retireSpend">退休後每月想花多少（用今天的物價來想） <span className="unit-hint">（元）</span></label>
        <input id="retireSpend" type="number" inputMode="decimal" step="any"
          value={form.retireManual ? form.retireSpend : String(defaultRetireSpend(totalExpNow, ratio))}
          onChange={(e) => set({ retireSpend: e.target.value, retireManual: true })} />
        <p className="note">退休後通常不用通勤、房貸可能已經繳完，所以預設抓目前支出的 {ratio}%，可以自己改。</p>
        {form.retireManual && (
          <button type="button" className="ghost small" onClick={() => set({ retireManual: false, retireSpend: "" })}>恢復為目前支出的 {ratio}%</button>
        )}
      </div>

      <details className="adv">
        <summary>人生大目標（選填）</summary>
        <p className="note">買房、買車或其他大筆支出：購買那一年會先付頭期款，之後每年還貸款。沒有要新增就不用打開，結果和先前完全相同。</p>
        {(() => {
          const houseGoal = form.lifeGoals.find((g) => g.type === "house");
          if (!houseGoal) return null;
          const pa = houseGoal.purchaseAge;
          return (
            <div className="soft-hint show" style={{ marginBottom: 10 }}>
              <p style={{ margin: "0 0 6px" }}>支出清單裡如果已經有「房租或房貸」，買房後通常要停掉：請在該筆支出填「到 {pa} 歲結束」（{pa} = 購買年齡），或刪除既有房貸，以免重複計算。</p>
              <button type="button" className="ghost small" onClick={() => set({
                expenses: form.expenses.map((e) => (e.name.includes("房租") || e.name.includes("房貸") ? { ...e, endAge: pa } : e)),
                showExpenseEndAge: true,
              })}>幫我把「房租或房貸」設定到 {pa} 歲結束</button>
            </div>
          );
        })()}
        {form.lifeGoals.map((g, i) => {
          const setGoal = (patch: Partial<LifeGoalRow>) => set({ lifeGoals: form.lifeGoals.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          const coreGoal: LifeGoal = {
            name: g.name, type: g.type, purchaseAge: num(g.purchaseAge), price: num(g.price),
            downMode: g.downMode, downValue: num(g.downValue), extraCosts: num(g.extraCosts),
            loanRatePct: num(g.loanRatePct), loanYears: num(g.loanYears),
          };
          const sum = goalCardSummary(coreGoal, num(form.ageNow), inp.inflation);
          const warn = shortfallWarnings.find((w) => w.startsWith(`${g.purchaseAge} 歲買${g.name}`));
          const idp = `goal${i}`;
          return (
            <div className="goal-card" key={i}>
              <div className="goal-field">
                <label htmlFor={`${idp}-name`}>名稱</label>
                <input id={`${idp}-name`} type="text" value={g.name} onChange={(e) => setGoal({ name: e.target.value })} />
              </div>
              <div className="goal-field">
                <label htmlFor={`${idp}-age`}>哪一歲買 <span className="unit-hint">（歲）</span></label>
                <input id={`${idp}-age`} type="number" inputMode="numeric" step="1" value={g.purchaseAge} onChange={(e) => setGoal({ purchaseAge: e.target.value })} />
              </div>
              <div className="goal-field">
                <label htmlFor={`${idp}-price`}>總價 <span className="unit-hint">（元，今日幣值）</span></label>
                <input id={`${idp}-price`} type="number" inputMode="decimal" step="any" value={g.price} onChange={(e) => setGoal({ price: e.target.value })} />
              </div>
              <div className="goal-field">
                <label>頭期款</label>
                <span className="seg" role="group" aria-label="頭期款輸入方式">
                  <button type="button" aria-pressed={g.downMode === "amount"} onClick={() => setGoal({ downMode: "amount" })}>金額</button>
                  <button type="button" aria-pressed={g.downMode === "pct"} onClick={() => setGoal({ downMode: "pct" })}>百分比</button>
                </span>
                <input type="number" inputMode="decimal" step="any" aria-label={g.downMode === "pct" ? "頭期款百分比（%）" : "頭期款金額（元）"} value={g.downValue} onChange={(e) => setGoal({ downValue: e.target.value })} />
                <span className="unit-hint">{g.downMode === "pct" ? "（%）" : "（元）"}</span>
              </div>
              <div className="goal-field">
                <label htmlFor={`${idp}-extra`}>一次性額外費用 <span className="unit-hint">（元，選填，例如稅費、裝潢）</span></label>
                <input id={`${idp}-extra`} type="number" inputMode="decimal" step="any" value={g.extraCosts} onChange={(e) => setGoal({ extraCosts: e.target.value })} />
              </div>
              <div className="goal-field">
                <label htmlFor={`${idp}-rate`}>貸款年利率 <span className="unit-hint">（%）</span></label>
                <input id={`${idp}-rate`} type="number" inputMode="decimal" step="any" value={g.loanRatePct} onChange={(e) => setGoal({ loanRatePct: e.target.value })} />
              </div>
              <div className="goal-field">
                <label htmlFor={`${idp}-years`}>貸款年數 <span className="unit-hint">（年，0 代表不貸款）</span></label>
                <input id={`${idp}-years`} type="number" inputMode="numeric" step="1" value={g.loanYears} onChange={(e) => setGoal({ loanYears: e.target.value })} />
              </div>
              <p className="note" style={{ margin: "8px 0 0" }}>
                貸款金額 {fmtPlain(Math.round(sum.loanAmount))} 元（今日幣值）。每月還款 {fmtPlain(Math.round(sum.monthlyNominal))} 元（帳面金額，每月固定），首年約當今日幣值 {fmtPlain(Math.round(sum.firstYearMonthlyReal))} 元。{sum.payoffAge > num(g.purchaseAge) ? `預計 ${sum.payoffAge} 歲還清。` : "不貸款。"}
              </p>
              {warn && <p className="soft-hint show" style={{ marginTop: 8 }}>{warn}</p>}
              <div style={{ marginTop: 8 }}>
                <button type="button" className="ghost small" onClick={() => set({ lifeGoals: form.lifeGoals.filter((_, j) => j !== i) })}>刪除這筆大目標</button>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {(["house", "car", "other"] as const).map((t) => {
            const preset = LIFE_GOAL_PRESETS[t];
            return (
              <button key={t} type="button" className="ghost small" disabled={form.lifeGoals.length >= 5}
                onClick={() => set({ lifeGoals: [...form.lifeGoals, {
                  name: preset.name, type: preset.type,
                  purchaseAge: String(num(form.ageNow) + (t === "house" ? 10 : 5)),
                  price: String(preset.price), downMode: preset.downMode, downValue: String(preset.downValue),
                  extraCosts: String(preset.extraCosts), loanRatePct: String(preset.loanRatePct), loanYears: String(preset.loanYears),
                }] })}>
                {t === "house" ? "＋買房" : t === "car" ? "＋買車" : "＋其他"}
              </button>
            );
          })}
        </div>
        {form.lifeGoals.length >= 5 && <p className="note">人生大目標最多 5 筆。</p>}
        <p className="note" style={{ marginTop: 10 }}>以下為假設值試算的教育性示範，非貸款或投資建議；實際利率、成數與費用以金融機構核定為準。</p>
      </details>

      <details className="adv">
        <summary>進階</summary>
        <div style={{ maxWidth: 340 }}>
          <label htmlFor="salaryGrowth">薪資每年調幅（還沒扣掉物價上漲） <span className="unit-hint">（%／年）</span></label>
          <input id="salaryGrowth" type="number" inputMode="decimal" step="any" value={form.salaryGrowth} onChange={(e) => set({ salaryGrowth: e.target.value })} />
          <p className="note">平均每年加薪幾 %，還沒扣掉物價上漲。</p>
        </div>
        {salaryRealGrowthNote(inp)}
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
          <input type="checkbox" checked={form.showExpenseEndAge} onChange={(e) => set({ showExpenseEndAge: e.target.checked })} />
          有些支出會在某個年紀結束嗎？（例如房貸、孩子學費）
        </label>
        <p className="note">打開後，每筆支出會多一個「到幾歲結束」欄位。</p>
      </details>
    </div></div>
  );
}
