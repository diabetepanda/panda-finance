// ui/steps/StepCashflow.tsx｜步驟 ② 每個月的錢（規格 Phase 5 第三節）
import type { FormState } from "../form";
import { num } from "../form";
import { defaultRetireSpend, salaryRealGrowthNote } from "./stepHelpers";
import { paramValue } from "../../config/defaults";
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
