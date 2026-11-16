// ui/App.tsx｜只負責輸入與顯示，所有數字一律從 core/ 取得，
// 預設值一律從 config/ 取得，元件中不寫死數字。
import { useEffect, useMemo, useRef, useState } from "react";
import { simulate, type SimInput, type SimResult } from "../core/simulate";
import { earliestRetirement, type EarliestResult } from "../core/retirement";
import { findExtraSavingForEarliest, type ExtraSavingSolution } from "../core/solver";
import { validateInput } from "../core/validate";
import { paramValue, EXAMPLE_EXPENSES } from "../config/defaults";
import { fmtMoney, fmtNum, fmtPct, fmtPlain, fmtRatePct, unitWord, basisTag, type Basis, type Unit } from "./format";
import Chart from "./chart";

interface ExpenseRow { name: string; amount: string; endAge: string; }
interface FormState {
  ageNow: string; ageRetire: string; ageLife: string;
  initAssets: string; otherRetireIncome: string;
  monthlyIncome: string; salaryGrowth: string;
  expenses: ExpenseRow[];
  retireSpend: string; retireManual: boolean;
  inflation: string; retPre: string; retPost: string;
}

const num = (s: string): number => (s.trim() === "" ? 0 : Number(s));

function defaultForm(): FormState {
  return {
    ageNow: String(paramValue("ageNow")),
    ageRetire: String(paramValue("ageRetire")),
    ageLife: String(paramValue("ageLife")),
    initAssets: String(paramValue("initAssets")),
    otherRetireIncome: String(paramValue("otherRetireIncome")),
    monthlyIncome: String(paramValue("monthlyIncome")),
    salaryGrowth: String(paramValue("salaryGrowth")),
    expenses: EXAMPLE_EXPENSES.map((e) => ({ name: e.name, amount: String(e.amount), endAge: "" })),
    retireSpend: "", retireManual: false,
    inflation: String(paramValue("inflation")),
    retPre: String(paramValue("retPre")),
    retPost: String(paramValue("retPost")),
  };
}

function toInput(f: FormState): SimInput {
  const totalExp = f.expenses.reduce((s, e) => s + (Number.isFinite(num(e.amount)) ? num(e.amount) : NaN), 0);
  const retireSpend = f.retireManual
    ? num(f.retireSpend)
    : Math.round(totalExp * (paramValue("retireSpendRatio") / 100));
  return {
    ageNow: num(f.ageNow), ageRetire: num(f.ageRetire), ageLife: num(f.ageLife),
    initAssets: num(f.initAssets), otherRetireIncome: num(f.otherRetireIncome),
    monthlyIncome: num(f.monthlyIncome), salaryGrowth: num(f.salaryGrowth),
    expenses: f.expenses.map((e) => ({
      name: e.name,
      amount: num(e.amount),
      endAge: e.endAge.trim() === "" ? null : Number(e.endAge),
    })),
    retireSpend,
    inflation: num(f.inflation), retPre: num(f.retPre), retPost: num(f.retPost),
    extraMonthlySaving: 0,
  } as SimInput;
}

interface Computed {
  inp: SimInput;
  res: SimResult;
  earliest: EarliestResult;
  totalMonthlyExpense: number;
  monthlyBalance: number;
  savingsRate: number | null;
  extraSolution: ExtraSavingSolution | null;
}

function compute(inp: SimInput): Computed {
  const res = simulate(inp, inp.ageRetire, 0);
  const earliest = earliestRetirement(inp);
  const totalMonthlyExpense = inp.expenses.reduce((s, e) => s + e.amount, 0);
  const monthlyBalance = inp.monthlyIncome - totalMonthlyExpense;
  const savingsRate = inp.monthlyIncome > 0 ? monthlyBalance / inp.monthlyIncome : null;
  const extraSolution = earliest.type === "none" ? findExtraSavingForEarliest(inp) : null;
  return { inp, res, earliest, totalMonthlyExpense, monthlyBalance, savingsRate, extraSolution };
}

const DISCLAIMER_FULL =
  "本網站為試算與教育工具，所有結果依據使用者輸入與假設值推算，不代表對未來報酬的預測，也不構成任何投資建議、金融商品推介或勸誘。各標的報酬率、通膨率、匯率變動、勞保勞退參數均為暫定假設值，使用者應自行查證並調整。歷史報酬不保證未來表現，投資有風險。勞保、勞退、稅務與健保規定可能變動，請以主管機關公告為準。本網站未考慮個人的完整財務狀況、風險承受度與投資目標，若需要專業意見，請洽具備資格的專業人士。";
const DISCLAIMER_SHORT = "以上為依假設值推算的試算結果，非預測，也不是投資建議。";

export default function App() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [debounced, setDebounced] = useState<FormState>(form);
  const [basis, setBasis] = useState<Basis>("real");
  const [unit, setUnit] = useState<Unit>("wan");
  const [exampleActive, setExampleActive] = useState(true);
  const [importMsg, setImportMsg] = useState("");
  const lastValid = useRef<Computed | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(form), paramValue("debounceMs"));
    return () => clearTimeout(id);
  }, [form]);

  const inp = useMemo(() => toInput(debounced), [debounced]);
  const validation = useMemo(() => validateInput(inp), [inp]);
  const computed = useMemo(() => {
    if (validation.valid) {
      const c = compute(inp);
      lastValid.current = c;
      return c;
    }
    return lastValid.current;
  }, [inp, validation.valid]);
  const stale = !validation.valid && lastValid.current !== null;

  const set = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setExampleActive(false); };
  const totalExpNow = form.expenses.reduce((s, e) => s + (Number.isFinite(num(e.amount)) ? num(e.amount) : 0), 0);
  const balanceNow = num(form.monthlyIncome) - totalExpNow;

  const clearAmounts = () => {
    setForm((f) => ({
      ...f,
      initAssets: "0", otherRetireIncome: "0", monthlyIncome: "0",
      expenses: f.expenses.map((e) => ({ ...e, amount: "0" })),
      retireSpend: "0", retireManual: true,
    }));
    setExampleActive(false);
  };

  const restoreRetireSpend = () => set({ retireManual: false, retireSpend: "" });

  const resetAssumptions = () => set({
    inflation: String(paramValue("inflation")),
    retPre: String(paramValue("retPre")),
    retPost: String(paramValue("retPost")),
    salaryGrowth: String(paramValue("salaryGrowth")),
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "panda-finance", version: 1, form }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "panda-finance-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File) => {
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        const f = data.form as FormState;
        if (!f || typeof f.ageNow !== "string" || !Array.isArray(f.expenses)) throw new Error("bad");
        setForm({ ...defaultForm(), ...f });
        setImportMsg("");
      } catch {
        setImportMsg("設定檔格式不正確，無法匯入，原來的數字沒有被改動。");
      }
    });
  };

  const downloadCsv = (c: Computed) => {
    const head = "年齡,年收入(元，今日幣值),年支出(元，今日幣值),年儲蓄(元，今日幣值),投資收益(元，今日幣值),年底資產(元，今日幣值)\n";
    const lines = c.res.rows.map((r) => [r.age, Math.round(r.income), Math.round(r.expense), Math.round(r.flow), Math.round(r.gain), Math.round(r.assets)].join(","));
    const blob = new Blob(["\uFEFF" + head + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "panda-finance-yearly.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const ratio = paramValue("retireSpendRatio");

  return (
    <>
      <div className="privacy-bar">你的資料只在這個瀏覽器中計算，不會被上傳或儲存</div>
      <div className="wrap">
        <header className="site-head">
          <h1>Panda Finance</h1>
          <p className="subtitle">台灣上班族理財規劃與退休試算</p>
        </header>

        {exampleActive && (
          <div className="example-banner no-print">
            <span>這是範例，請改成你自己的數字——把左邊（手機是上方）的欄位換成你的實際金額即可。</span>
            <button type="button" className="ghost small" style={{ background: "transparent" }} onClick={clearAmounts}>一鍵清空金額</button>
          </div>
        )}

        <div className="layout">
          <div className="inputs-col">
            <details className="card" open>
              <summary>1. 基本資料</summary>
              <div className="card-body">
                <div className="grid3">
                  <div><label htmlFor="ageNow">現在年齡（歲）</label><input id="ageNow" type="number" inputMode="numeric" step="1" value={form.ageNow} onChange={(e) => set({ ageNow: e.target.value })} /></div>
                  <div><label htmlFor="ageRetire">預計退休年齡（歲）</label><input id="ageRetire" type="number" inputMode="numeric" step="1" value={form.ageRetire} onChange={(e) => set({ ageRetire: e.target.value })} /></div>
                  <div><label htmlFor="ageLife">預期壽命（歲）</label><input id="ageLife" type="number" inputMode="numeric" step="1" value={form.ageLife} onChange={(e) => set({ ageLife: e.target.value })} /></div>
                </div>
                <p className="msg">{validation.ageErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>
                <div className="grid2">
                  <div><label htmlFor="initAssets">目前已有可投資資產 <span className="unit-hint">（元）</span></label><input id="initAssets" type="number" inputMode="decimal" step="any" value={form.initAssets} onChange={(e) => set({ initAssets: e.target.value })} /></div>
                  <div><label htmlFor="otherRetireIncome">其他退休收入 <span className="unit-hint">（元／月，今日幣值，選填）</span></label><input id="otherRetireIncome" type="number" inputMode="decimal" step="any" value={form.otherRetireIncome} onChange={(e) => set({ otherRetireIncome: e.target.value })} /></div>
                </div>
                <p className="note">「其他退休收入」指退休後每月固定進帳（例如租金收入），以今日幣值填寫；本階段不含勞保、勞退。</p>
                <p className="msg">{validation.basicErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>
              </div>
            </details>

            <details className="card" open>
              <summary>2. 收入與支出</summary>
              <div className="card-body">
                <div className="grid2">
                  <div><label htmlFor="monthlyIncome">每月收入 <span className="unit-hint">（稅後實領，元）</span></label><input id="monthlyIncome" type="number" inputMode="decimal" step="any" value={form.monthlyIncome} onChange={(e) => set({ monthlyIncome: e.target.value })} /></div>
                  <div><label htmlFor="salaryGrowth">預期薪資年成長率 <span className="unit-hint">（名目，%／年）</span></label><input id="salaryGrowth" type="number" inputMode="decimal" step="any" value={form.salaryGrowth} onChange={(e) => set({ salaryGrowth: e.target.value })} /></div>
                </div>
                <div className="expense-head" aria-hidden="true"><span>支出項目</span><span>每月金額（元）</span><span>結束年齡</span><span /></div>
                {form.expenses.map((e, i) => (
                  <div className="expense-row" key={i}>
                    <input type="text" className="exp-name" aria-label="支出項目名稱" value={e.name}
                      onChange={(ev) => set({ expenses: form.expenses.map((x, j) => j === i ? { ...x, name: ev.target.value } : x) })} />
                    <input type="number" className="exp-amount" aria-label="每月金額（元）" inputMode="decimal" step="any" value={e.amount}
                      onChange={(ev) => set({ expenses: form.expenses.map((x, j) => j === i ? { ...x, amount: ev.target.value } : x) })} />
                    <input type="number" className="exp-end f-end" aria-label="到第幾歲結束（選填）" inputMode="numeric" step="1" placeholder="到第幾歲結束（選填）" value={e.endAge}
                      onChange={(ev) => set({ expenses: form.expenses.map((x, j) => j === i ? { ...x, endAge: ev.target.value } : x) })} />
                    <button type="button" className="del" aria-label="刪除此支出項目"
                      onClick={() => set({ expenses: form.expenses.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="ghost small" onClick={() => set({ expenses: [...form.expenses, { name: "新項目", amount: "0", endAge: "" }] })}>＋ 新增支出項目</button>
                </div>
                <p className="msg">{validation.incomeErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>
                <div className="totals" aria-live="polite">
                  <div><span>每月支出合計</span><b>{fmtPlain(totalExpNow)} 元</b></div>
                  <div><span>每月結餘</span><b>{fmtPlain(balanceNow)} 元</b></div>
                  <div><span>儲蓄率<span className="q" tabIndex={0} data-tip="每月結餘 ÷ 每月收入。收入為 0 時無法計算，顯示「—」。">?</span></span><b>{num(form.monthlyIncome) > 0 ? fmtPct(balanceNow / num(form.monthlyIncome)) : "—"}</b></div>
                </div>
                {balanceNow < 0 && <p className="soft-hint show">目前每月支出高於收入，下面的試算會把這個缺口一併計入。</p>}
                <label htmlFor="retireSpend">退休後每月想花多少 <span className="unit-hint">（元，今日幣值）</span><span className="q" tabIndex={0} data-tip={`退休後每個月的支出，以今天的購買力（今日幣值）填寫。預設是目前每月支出總額的 ${ratio}%。`}>?</span></label>
                <input id="retireSpend" type="number" inputMode="decimal" step="any"
                  value={form.retireManual ? form.retireSpend : String(Math.round(totalExpNow * (ratio / 100)))}
                  onChange={(e) => set({ retireSpend: e.target.value, retireManual: true })} />
                {form.retireManual && (
                  <div id="restoreWrap"><button type="button" className="ghost small" onClick={restoreRetireSpend}>恢復為目前支出的 {ratio}%</button></div>
                )}
              </div>
            </details>

            <details className="card" open>
              <summary>3. 假設參數</summary>
              <div className="card-body">
                <p className="note" style={{ marginTop: 6 }}>預設值為假設，請自行查證後調整。以下數字都是「假設值」，不是對未來的預測。</p>
                <div className="grid3">
                  <div><label htmlFor="inflation">通膨率 <span className="unit-hint">（%／年）</span></label><input id="inflation" type="number" inputMode="decimal" step="any" value={form.inflation} onChange={(e) => set({ inflation: e.target.value })} /></div>
                  <div><label htmlFor="retPre">投資年化報酬率 <span className="unit-hint">（名目，%／年）</span></label><input id="retPre" type="number" inputMode="decimal" step="any" value={form.retPre} onChange={(e) => set({ retPre: e.target.value })} /></div>
                  <div><label htmlFor="retPost">退休後年化報酬率 <span className="unit-hint">（名目，%／年）</span></label><input id="retPost" type="number" inputMode="decimal" step="any" value={form.retPost} onChange={(e) => set({ retPost: e.target.value })} /></div>
                </div>
                <p className="note">實質報酬率<span className="q" tabIndex={0} data-tip="扣掉通膨後的報酬率，算法是 (1＋名目報酬率) ÷ (1＋通膨率) − 1，不能直接用相減。">?</span>會依通膨自動換算，不需另外輸入。</p>
                <p className="msg">{[...validation.assumpErrors, ...validation.warnings].map((m, i) => <span key={i}>{m}<br /></span>)}</p>
                {Number.isFinite(num(form.retPost)) && Number.isFinite(num(form.retPre)) && num(form.retPost) > num(form.retPre) && (
                  <p className="soft-hint show">目前退休後報酬假設（{form.retPost}%）高於退休前（{form.retPre}%），請確認這是你的意思。</p>
                )}
                <div>
                  <button type="button" className="ghost small" onClick={resetAssumptions}>還原預設值</button>
                  <span className="note">（通膨 {paramValue("inflation")}%、投資報酬 {paramValue("retPre")}%、退休後報酬 {paramValue("retPost")}%、薪資成長 {paramValue("salaryGrowth")}%）</span>
                </div>
              </div>
            </details>

            <div className="card no-print">
              <div className="card-body" style={{ paddingTop: 16 }}>
                <div className="actions">
                  <button type="button" className="ghost" onClick={exportJson}>匯出設定檔（JSON）</button>
                  <span className="file-pick">
                    <span className="file-pick-name">匯入設定檔</span>
                    <input ref={fileRef} type="file" accept="application/json" aria-label="匯入設定檔"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
                  </span>
                  <button type="button" className="ghost" onClick={() => window.print()}>列印 / 另存 PDF</button>
                </div>
                <p className="note">匯出與匯入都是你主動點按才會發生的操作；本頁不會自動儲存任何資料。匯出的設定檔只含你輸入的數字，不含試算結果。</p>
                <p className="msg">{importMsg}</p>
              </div>
            </div>
          </div>

          <div className="results-col">
            {stale && <p className="stale-banner show">目前輸入有需要修正的地方，以下顯示的是上一次有效輸入的結果。</p>}
            {computed ? <Results c={computed} basis={basis} unit={unit} setBasis={setBasis} setUnit={setUnit} onCsv={() => downloadCsv(computed)} /> : (
              <div className="card"><div className="card-body"><p className="note">請先修正左側輸入的提示，再查看試算結果。</p></div></div>
            )}
          </div>
        </div>

        <footer className="disclaimer">
          <h2>免責聲明</h2>
          <p>{DISCLAIMER_FULL}</p>
        </footer>
      </div>
    </>
  );
}

function Results({ c, basis, unit, setBasis, setUnit, onCsv }: {
  c: Computed; basis: Basis; unit: Unit;
  setBasis: (b: Basis) => void; setUnit: (u: Unit) => void; onCsv: () => void;
}) {
  const { inp, res, earliest } = c;
  const A = inp.ageNow, R = inp.ageRetire, L = inp.ageLife;
  const money = (v: number, t: number) => fmtMoney(v, t, inp.inflation, basis, unit);
  const rawMoney = (real: number, realNom: number) =>
    basis === "nominal" ? `${fmtNum(realNom, unit)} ${unitWord(unit)}（名目）` : `${fmtNum(real, unit)} ${unitWord(unit)}（今日幣值）`;

  let earliestMain = "", earliestSub = "";
  if (earliest.type === "already") {
    // 功能 (b)：已退休依資產能否撐到預期壽命分開顯示
    if (earliest.lastsToLife) {
      earliestMain = "已退休，可撐到預期壽命";
      earliestSub = `目前已是退休狀態，在這組假設下，資產可撐到預期壽命 ${L} 歲`;
    } else {
      earliestMain = "已退休，資產不足以撐到預期壽命";
      earliestSub = `目前已是退休狀態，但資產將在 ${earliest.exhaustAge} 歲耗盡，撐不到預期壽命 ${L} 歲`;
    }
  } else if (earliest.type === "age") {
    earliestMain = `${earliest.age} 歲`;
    earliestSub = "在這組假設下，資產可撐到預期壽命的最早退休年齡";
  } else {
    earliestMain = "無法達成";
    earliestSub = `在目前假設下無法達成（試算到 ${paramValue("earliestRetirementCap")} 歲）`;
  }

  return (
    <>
      <div className="summary-sticky">
        <div className="summary-grid">
          <div className="sum-card">
            <div className="k">退休時預估資產</div>
            <div className="v">{money(res.retireAssets, R - A)}</div>
            <div className="s">{R === A ? "目前（已退休）時點的資產" : `在 ${R} 歲退休時`}</div>
          </div>
          <div className="sum-card">
            <div className="k">退休所需資金</div>
            <div className="v">{res.required > 0 ? money(res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</div>
            <div className="s">{res.required > 0
              ? <>資金達成率 {fmtPct(res.achieve)}<span className="q" tabIndex={0} data-tip="退休時預估資產 ÷ 退休所需資金。100% 表示剛好撐到預期壽命。">?</span></>
              : (res.shortfall <= 0 ? "退休支出已由其他退休收入覆蓋" : "無退休年數")}</div>
          </div>
          <div className="sum-card">
            <div className="k">最早可退休年齡</div>
            <div className="v" style={{ fontSize: earliest.type === "already" ? "1.05rem" : undefined }}>{earliestMain}</div>
            <div className="s">{earliestSub}</div>
          </div>
          <div className="sum-card">
            <div className="k">資產可撐到幾歲</div>
            <div className="v">{res.exhaustAge === null ? `${L} 歲` : `${res.exhaustAge} 歲耗盡`}</div>
            <div className="s">{res.exhaustAge === null ? "可撐到預期壽命" : `資產在 ${res.exhaustAge} 歲年底用完`}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>試算結果</h2></div>
        <div className="card-body">
          <p className="note" style={{ marginTop: 2 }}>在這組假設下，結果是：</p>
          <div className="toggle-row no-print">
            <span><span className="tg-label">金額口徑</span>
              <span className="seg" role="group" aria-label="金額口徑">
                <button type="button" aria-pressed={basis === "real"} onClick={() => setBasis("real")}>今日幣值<span className="q" tabIndex={0} data-tip="以今天的購買力表示，已經排除通膨影響，方便跨年份比較。">?</span></button>
                <button type="button" aria-pressed={basis === "nominal"} onClick={() => setBasis("nominal")}>名目<span className="q" tabIndex={0} data-tip="未扣通膨的帳面金額：實質金額 × (1＋通膨率)^經過年數。年份越遠，名目金額越大。">?</span></button>
              </span></span>
            <span><span className="tg-label">顯示單位</span>
              <span className="seg" role="group" aria-label="顯示單位">
                <button type="button" aria-pressed={unit === "wan"} onClick={() => setUnit("wan")}>萬元</button>
                <button type="button" aria-pressed={unit === "yuan"} onClick={() => setUnit("yuan")}>元</button>
              </span></span>
          </div>

          <table className="result-table"><tbody>
            <tr><th>每月結餘</th><td>{money(c.monthlyBalance, 0)}</td></tr>
            <tr><th>儲蓄率</th><td>{fmtPct(c.savingsRate)}</td></tr>
            <tr><th>一輩子工作收入估算（實質）</th><td>{fmtNum(res.lifetimeReal, unit)} {unitWord(unit)}（今日幣值）</td></tr>
            <tr><th>一輩子工作收入估算（名目）</th><td>{fmtNum(res.lifetimeNom, unit)} {unitWord(unit)}（名目）</td></tr>
            <tr><th>退休時預估資產</th><td>{money(res.retireAssets, R - A)}</td></tr>
            <tr><th>退休所需資金</th><td>{res.required > 0 ? money(res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</td></tr>
            <tr><th>資金達成率</th><td>{res.achieve === null ? "—" : fmtPct(res.achieve)}</td></tr>
            <tr><th>資產可撐到幾歲</th><td>{res.exhaustAge === null
              ? `可撐到預期壽命，預期壽命時剩餘資產約 ${money(res.finalAssets, L - A)}`
              : `資產將在 ${res.exhaustAge} 歲耗盡`}</td></tr>
            {res.workGap > 0 && <tr><th>工作期間資金缺口（累計）</th><td>{rawMoney(res.workGap, res.workGapNom)}</td></tr>}
            {res.uncovered > 0 && <tr><th>未被覆蓋的支出（累計）</th><td>{rawMoney(res.uncovered, res.uncoveredNom)}</td></tr>}
          </tbody></table>
          <p className="note">一輩子工作收入：這是依你輸入的薪資與成長率推算的估計值，不是保證。</p>

          {earliest.type === "none" && (
            <div className="note" style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 6px" }}>最早可退休年齡：在目前假設下無法達成。可以調整的方向包括：提高每月儲蓄、延後退休年齡、降低退休後支出、調整報酬假設值。</p>
              {c.extraSolution?.found ? (
                <p style={{ margin: 0 }}>用試算結果來看：若每月多存 {fmtPlain(c.extraSolution.extraMonthly)} 元（今日幣值），最早可於 {c.extraSolution.earliestAge} 歲退休（其餘假設不變）。</p>
              ) : c.extraSolution ? (
                <p style={{ margin: 0 }}>用試算結果來看：即使每月多存到月收入的 {paramValue("solverMaxExtraMultiple")} 倍，在目前其他假設下仍無法於 {paramValue("earliestRetirementCap")} 歲前達成，需要同時調整其他方向（例如降低退休後支出或延後預期退休安排）。</p>
              ) : null}
            </div>
          )}
          {earliest.type === "already" && (
            <p className="note" style={{ marginTop: 10 }}>{earliestSub}。</p>
          )}

          <p className="note" style={{ marginTop: 10 }}>{DISCLAIMER_SHORT}</p>
          <p className="print-only">主要假設：現在年齡 {A} 歲、預計退休 {R} 歲、預期壽命 {L} 歲；通膨率假設 {inp.inflation}%、投資年化報酬率假設（名目）{inp.retPre}%、退休後年化報酬率假設（名目）{inp.retPost}%、薪資年成長率假設（名目）{inp.salaryGrowth}%。</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>資產隨年齡變化</h2></div>
        <div className="card-body">
          <div className="legend">
            <span><i className="sw work" />工作期間（實線）</span>
            <span><i className="sw retire" />退休期間（虛線）</span>
            <span><i className="sw exhaust" />資產耗盡點</span>
          </div>
          <Chart res={res} inp={inp} basis={basis} unit={unit} />
        </div>
      </div>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>逐年明細表</summary>
        <div className="card-body">
          <div className="actions no-print" style={{ marginBottom: 10 }}>
            <button type="button" className="ghost small" onClick={onCsv}>匯出 CSV（今日幣值，元）</button>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead><tr><th>年齡</th><th>年收入</th><th>年支出</th><th>年儲蓄</th><th>投資收益</th><th>年底資產</th></tr></thead>
              <tbody>
                {res.rows.map((row) => {
                  const f = basis === "nominal" ? Math.pow(1 + inp.inflation / 100, row.t) : 1;
                  const cv = (v: number) => fmtNum(v * f, unit);
                  return (
                    <tr key={row.age} className={row.phase === "retire" ? "retire-row" : row.phase === "now" ? "now-row" : ""}>
                      <td>{row.age}</td><td>{cv(row.income)}</td><td>{cv(row.expense)}</td>
                      <td>{cv(row.flow)}</td><td>{cv(row.gain)}</td><td>{cv(row.assets)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">金額單位：{unitWord(unit)}{basisTag(basis)}。退休期間的年儲蓄欄為每年支出缺口的負值。</p>
        </div>
      </details>

      <details className="card" id="calcNotes" style={{ marginTop: 16 }}>
        <summary>計算說明（這些數字怎麼來的）</summary>
        <div className="card-body calc-notes">
          <p>本頁以「年」為單位逐年往下算：年齡用整數、每一年的現金流都假設在<b>年底</b>發生。現在年齡記為 A、退休年齡 R、預期壽命 L；工作年數＝R−A，退休年數＝L−R。所有金額先以浮點數精算，顯示時才取整；每個除法在計算前都會先檢查分母。</p>
          <p><b>目前採用的參數值</b>（會隨左側輸入即時更新）：</p>
          <ul>
            <li>通膨率假設：{inp.inflation}%／年</li>
            <li>投資年化報酬率假設（名目）：{inp.retPre}%／年 → 實質報酬率 <code>r</code> ＝ {fmtRatePct(res.r)}</li>
            <li>退休後年化報酬率假設（名目）：{inp.retPost}%／年 → 退休後實質報酬率 <code>rho</code> ＝ {fmtRatePct(res.rho)}</li>
            <li>薪資年成長率假設（名目）：{inp.salaryGrowth}%／年 → 實質薪資成長率 <code>g</code> ＝ {fmtRatePct(res.g)}</li>
          </ul>
          <p><b>報酬率的換算</b>：實質報酬率不是名目減通膨，而是 <code>r ＝ (1＋名目報酬率) ÷ (1＋通膨率) − 1</code>；實質薪資成長率 <code>g</code> 用同樣方式換算。名目金額與實質金額的換算為 <code>名目 ＝ 實質 × (1＋通膨率)^經過年數</code>，經過年數從現在起算。</p>
          <p><b>工作期</b>（第 t 年，t＝1…R−A）：</p>
          <ul>
            <li>實質年收入 ＝ 月收入 × 12 × (1＋g)^(t−1)</li>
            <li>實質年支出 ＝ 各支出項目年總和。單一通膨假設下，支出以今日幣值維持不變；項目若填了「到第幾歲結束」，以該年年底年齡 A＋t 判斷，超過結束年齡後就不再計入。</li>
            <li>年儲蓄 ＝ 年收入 − 年支出（可以是負數）。</li>
            <li>年底資產 ＝ 上一年年底資產 × (1＋r) ＋ 年儲蓄。</li>
            <li>若資產變成負數，模擬中以 0 為下限，差額累計為「資金缺口」並提示透支，不讓負資產繼續計息。</li>
          </ul>
          <p><b>退休期</b>（第 k 年，k＝1…L−R）：</p>
          <ul>
            <li>實質退休支出 ＝ 退休後月支出 × 12，固定不變；收入來源 ＝ 其他退休收入 × 12。</li>
            <li>每年支出缺口 ＝ max(0, 退休支出 − 其他退休收入年額)。其他退休收入若超過支出，超額部分不回頭投入、不增加資產（這是偏保守的簡化）。</li>
            <li>年底資產 ＝ 上一年年底資產 × (1＋rho) − 缺口。</li>
            <li>資產降到 0 以下的那一年，其年底年齡記為「資產耗盡年齡」，之後資產以 0 顯示，沒被覆蓋的缺口累計為「未被覆蓋的支出」。</li>
          </ul>
          <p><b>退休所需資金</b>：退休當下需要準備多少，才能剛好撐到預期壽命 ＝ 把退休期間每年的缺口以退休後實質報酬率折現回退休時點的現值總和。每年缺口固定為 P、年數為 n 時：<code>P × (1 − (1＋rho)^(−n)) ÷ rho</code>；當 rho＝0 時改用 <code>P × n</code>，不會除以零。資金達成率 ＝ 退休時預估資產 ÷ 退休所需資金。</p>
          <p><b>最早可退休年齡</b>：從 A＋1 歲起逐歲試算到 {paramValue("earliestRetirementCap")} 歲，每個候選年齡都重跑一次完整模擬（工作期長短跟著改變，不假設結果單調），回傳第一個資產能撐到預期壽命的年齡，容許 {paramValue("exhaustTolerance")} 元誤差。若退休年齡就等於現在年齡，視為已退休，並依資產能否撐到預期壽命分別顯示。無法達成時，本頁會另外以二分搜尋試算「每月多存多少」才可達成（搜尋使用同一個模擬引擎）。</p>
          <p><b>一輩子工作收入</b>：工作期每年的實質年收入總和；名目總和則是每年先乘上 (1＋通膨率)^t 再加總，不是用單一倍率換算。</p>
        </div>
      </details>
    </>
  );
}
