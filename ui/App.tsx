// ui/App.tsx｜只負責輸入與顯示，所有數字一律從 core/ 取得，
// 預設值一律從 config/ 取得，元件中不寫死數字。
import { useEffect, useMemo, useRef, useState } from "react";
import type { SimInput, SimResult } from "../core/simulate";
import type { EarliestResult } from "../core/retirement";
import { defaultRetireSpend } from "../core/retirement";
import { findExtraSavingForEarliest, type ExtraSavingSolution } from "../core/solver";
import { validateInput } from "../core/validate";
import { computePhase1, computeScenarios, monthlyTotals, salaryRealGrowth, defaultScenarioInflation, type ScenariosOutcome, type ScenarioOutcome } from "../core/compute";
import { laborPensionMonthlyEligibilityWarning, type SocialInput } from "../core/social";
import { socialParamValue, bracketFor, LI_SALARY_BRACKETS, LR_WAGE_BRACKETS } from "../config/social";
import { goalSavingAnswers, goalSpendAnswers, goalEarliestAnswers } from "../core/goals";
import { assetComparison, purchasingPowerSeries, socialVariants } from "../core/compare";
import { realToNominal, nominalToReal } from "../core/rates";
import { paramValue, EXAMPLE_EXPENSES } from "../config/defaults";
import { ASSETS, ASSET_MAP, ALLOCATION_PRESETS, SCENARIO_IDS, SCENARIO_LABELS, type ScenarioId } from "../config/assets";
import { sumOtherRetireIncome } from "../core/otherIncome";
import { pickKnownFields } from "../core/importForm";
import { investCompare } from "../core/investCompare";
import { dca, dcaPair } from "../core/dca";
import { defaultCategoryFor, type CategoryId } from "../config/categories";
import { fmtMoney, fmtNum, fmtPct, fmtPlain, fmtRatePct, unitWord, basisTag, type Basis, type Unit } from "./format";
import Chart, { ScenarioChart, MultiLineChart, IncomeStackChart, PurchasingPowerChart, AssetRangeBars } from "./chart";

interface ExpenseRow { name: string; amount: string; endAge: string; category: CategoryId; }
interface FormState {
  ageNow: string; ageRetire: string; ageLife: string;
  initAssets: string; otherRetireIncome: string;
  monthlyIncome: string; salaryGrowth: string;
  expenses: ExpenseRow[];
  retireSpend: string; retireManual: boolean;
  retPre: string; retPost: string;
  // Phase 4 其他退休收入小幫手
  otherRent: string; otherAnnuity: string; otherPartTime: string;
  // Phase 2
  assetsEnabled: boolean;
  allocation: Record<string, string>;
  retireAllocMode: "same" | "custom";
  retireAllocation: Record<string, string>;
  fxChange: string;
  returnOverrides: Record<string, Record<ScenarioId, string>>;
  deduction: string;
  // Phase 3 勞保勞退
  socialEnabled: boolean;
  liExistingYears: string;
  liPlannedYears: string; liPlannedManual: boolean;
  liAvgSalary: string; liSalaryManual: boolean;
  liClaimAge: string; liDiscount: string; liIndexed: boolean;
  lrWage: string; lrWageManual: boolean;
  lrEmployerRate: string; lrEmployeeRate: string; lrFundReturn: string;
  lrBalance: string; lrMode: "lump" | "monthly"; lrClaimAge: string;
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
    expenses: EXAMPLE_EXPENSES.map((e) => ({ name: e.name, amount: String(e.amount), endAge: "", category: defaultCategoryFor(e.name) })),
    retireSpend: "", retireManual: false,
    otherRent: "", otherAnnuity: "", otherPartTime: "",
    retPre: String(paramValue("retPre")),
    retPost: String(paramValue("retPost")),
    assetsEnabled: false,
    allocation: Object.fromEntries(ASSETS.map((a) => [a.id, a.id === "tw0050" || a.id === "voo" ? "50" : "0"])),
    retireAllocMode: "same",
    retireAllocation: Object.fromEntries(ASSETS.map((a) => [a.id, "0"])),
    fxChange: String(paramValue("fxChange")),
    returnOverrides: Object.fromEntries(ASSETS.map((a) => [a.id, Object.fromEntries(SCENARIO_IDS.map((id) => [id, String(a.returns[id].value)])) as Record<ScenarioId, string>])),
    deduction: String(paramValue("retireReturnDeduction")),
    socialEnabled: true,
    liExistingYears: "0",
    liPlannedYears: "", liPlannedManual: false,
    liAvgSalary: "", liSalaryManual: false,
    liClaimAge: String(socialParamValue("liLegalClaimAge")), liDiscount: "0", liIndexed: true,
    lrWage: "", lrWageManual: false,
    lrEmployerRate: String(socialParamValue("lrEmployerRate")), lrEmployeeRate: "0",
    lrFundReturn: String(socialParamValue("lrFundReturn")),
    lrBalance: "0", lrMode: "lump", lrClaimAge: String(socialParamValue("lrLegalClaimAge")),
  };
}

function toInput(f: FormState): SimInput {
  const totalExp = f.expenses.reduce((s, e) => s + (Number.isFinite(num(e.amount)) ? num(e.amount) : NaN), 0);
  const retireSpend = f.retireManual
    ? num(f.retireSpend)
    : defaultRetireSpend(totalExp, paramValue("retireSpendRatio"));
  return {
    ageNow: num(f.ageNow), ageRetire: num(f.ageRetire), ageLife: num(f.ageLife),
    initAssets: num(f.initAssets), otherRetireIncome: num(f.otherRetireIncome),
    monthlyIncome: num(f.monthlyIncome), salaryGrowth: num(f.salaryGrowth),
    expenses: f.expenses.map((e) => ({
      name: e.name,
      amount: num(e.amount),
      endAge: e.endAge.trim() === "" ? null : Number(e.endAge),
      category: e.category ?? "other",
    })),
    retireSpend,
    inflation: paramValue("inflation"), // Phase 4：通膨固定 2%，不再由使用者輸入
    retPre: num(f.retPre), retPost: num(f.retPost),
    extraMonthlySaving: 0,
    categoryInflation: null, // Phase 4 起 UI 不使用（core 保留供日後擴充）
    retireSpendCategories: null,
    social: f.socialEnabled
      ? {
          laborInsurance: {
            existingYears: num(f.liExistingYears),
            plannedYears: f.liPlannedManual ? num(f.liPlannedYears) : null,
            avgInsuredSalary: f.liSalaryManual ? num(f.liAvgSalary) : bracketFor(num(f.monthlyIncome), LI_SALARY_BRACKETS, socialParamValue("liSalaryCap")),
            claimAge: num(f.liClaimAge),
            discountPct: num(f.liDiscount),
            indexed: f.liIndexed,
          },
          laborPension: {
            monthlyWage: f.lrWageManual ? num(f.lrWage) : bracketFor(num(f.monthlyIncome), LR_WAGE_BRACKETS, socialParamValue("lrWageCap")),
            employerRatePct: num(f.lrEmployerRate),
            employeeRatePct: num(f.lrEmployeeRate),
            fundReturnPct: num(f.lrFundReturn),
            currentBalance: num(f.lrBalance),
            mode: f.lrMode,
            claimAge: num(f.lrClaimAge),
          },
        } as SocialInput
      : null,
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
  scenarios: ScenariosOutcome | null; // Phase 2：標的啟用時的三情境結果
  goalScen: ScenariosOutcome; // Phase 3：目標反推/比較圖的三情境管線（標的啟用時使用）
}

function compute(inp: SimInput, f: FormState): Computed {
  const out = computePhase1(inp);
  const totals = monthlyTotals(inp);
  const extraSolution = out.earliest.type === "none" ? findExtraSavingForEarliest(inp) : null;
  const scenSettings = {
    allocation: Object.fromEntries(Object.entries(f.allocation).map(([k, v]) => [k, num(v)])),
    retireAllocMode: f.retireAllocMode,
    retireAllocation: Object.fromEntries(Object.entries(f.retireAllocation).map(([k, v]) => [k, num(v)])),
    fxChangePct: num(f.fxChange),
    returnOverrides: Object.fromEntries(Object.entries(f.returnOverrides).map(([k, rec]) => [k, Object.fromEntries(Object.entries(rec).map(([sid, v]) => [sid, num(v)])) as Record<ScenarioId, number>])),
    scenarioInflation: defaultScenarioInflation(), // Phase 4：三情境通膨固定（2.5／2／1.5）
    deductionPct: num(f.deduction),
  };
  const scenOutcome = computeScenarios(inp, scenSettings);
  const scenarios: ScenariosOutcome | null = f.assetsEnabled ? scenOutcome : null;
  return {
    inp, res: out.res, earliest: out.earliest,
    totalMonthlyExpense: totals.totalExpense, monthlyBalance: totals.balance,
    savingsRate: totals.totalIncome > 0 ? totals.savingsRate : null,
    extraSolution, scenarios, goalScen: scenOutcome,
  };
}

const DISCLAIMER_FULL =
  "本網站為試算與教育工具，所有結果依據使用者輸入與假設值推算，不代表對未來報酬的預測，也不構成任何投資建議、金融商品推介或勸誘。各標的報酬率、通膨率、匯率變動、勞保勞退參數均為依公開資料推得的假設值（查證日 2026-11-17），使用者可自行調整。歷史報酬不保證未來表現，投資有風險。勞保、勞退、稅務與健保規定可能變動，請以主管機關公告為準。本網站未考慮個人的完整財務狀況、風險承受度與投資目標，若需要專業意見，請洽具備資格的專業人士。";
const DISCLAIMER_SHORT = "以上為依假設值推算的試算結果，非預測，也不是投資建議。";
const COMPLIANCE = "以下為假設值試算的教育性比較，非預測、非投資建議，也不代表任何金融商品的推介。歷史報酬不代表未來，投資有虧損風險。";
const INFLATION_FIXED_NOTE = "通膨率固定以 2% 計算。依據：主計總處 CPI 年增率 113 年 2.18%、114 年 1.66%、115 年 1–10 月 1.98%；中央銀行表示通膨率中長期平均 2% 左右可以接受。";

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
      const c = compute(inp, debounced);
      lastValid.current = c;
      return c;
    }
    return lastValid.current;
  }, [inp, validation.valid, debounced]);
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
        // Phase 4：只保留目前 FormState 的欄位，舊檔的已刪除欄位直接忽略
        setForm(pickKnownFields(f as unknown as Record<string, unknown>, defaultForm() as unknown as Record<string, unknown>) as unknown as FormState);
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
                  <div><label htmlFor="otherRetireIncome">其他退休收入（勞保、勞退以外） <span className="unit-hint">（元／月，今日幣值，選填）</span></label><input id="otherRetireIncome" type="number" inputMode="decimal" step="any" value={form.otherRetireIncome} onChange={(e) => set({ otherRetireIncome: e.target.value })} /></div>
                </div>
                <p className="note">退休後每個月固定會有的其他收入，例如：房租淨收入、年金險或儲蓄險每月給付、退休後兼職、公教或軍職退休金。大部分上班族填 0 即可；不確定就填 0，結果會偏保守。勞保、勞退請在「勞保與勞退」區設定，不要重複填。</p>
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
                {(() => {
                  const g = salaryRealGrowth(inp);
                  const years = Math.max(0, inp.ageRetire - inp.ageNow);
                  const pp = nominalToReal(inp.monthlyIncome, inp.inflation / 100, years);
                  return (
                    <p className="note">
                      薪水有沒有跑贏通膨：實質薪資成長率 g ＝ {fmtRatePct(g)}／年。
                      {g > 0
                        ? " 薪資成長高於通膨，購買力正在增加。"
                        : g < 0
                          ? <> <b>購買力正在下降。</b>若薪水金額維持不變，{years} 年後同樣的薪水約可買到相當於今天的 {fmtPlain(Math.round(pp))} 元。</>
                          : " 薪資成長與通膨相同，購買力不變。"}
                    </p>
                  );
                })()}
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
                  <button type="button" className="ghost small" onClick={() => set({ expenses: [...form.expenses, { name: "新項目", amount: "0", endAge: "", category: "other" as CategoryId }] })}>＋ 新增支出項目</button>
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
                  value={form.retireManual ? form.retireSpend : String(defaultRetireSpend(totalExpNow, ratio))}
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
                <p className="note">{INFLATION_FIXED_NOTE}</p>
                <div className="grid2">
                  <div><label htmlFor="retPre">投資年化報酬率 <span className="unit-hint">（名目，%／年，大盤型 ETF 為主的組合）</span></label><input id="retPre" type="number" inputMode="decimal" step="any" value={form.retPre} onChange={(e) => set({ retPre: e.target.value })} /></div>
                  <div><label htmlFor="retPost">退休後年化報酬率 <span className="unit-hint">（名目，%／年）</span></label><input id="retPost" type="number" inputMode="decimal" step="any" value={form.retPost} onChange={(e) => set({ retPost: e.target.value })} /></div>
                </div>
                <p className="note">實質報酬率<span className="q" tabIndex={0} data-tip="扣掉通膨後的報酬率，算法是 (1＋名目報酬率) ÷ (1＋通膨率) − 1，不能直接用相減。">?</span>會依通膨（固定 2%）自動換算，不需另外輸入。</p>
                <p className="msg">{[...validation.assumpErrors, ...validation.warnings].map((m, i) => <span key={i}>{m}<br /></span>)}</p>
                {Number.isFinite(num(form.retPost)) && Number.isFinite(num(form.retPre)) && num(form.retPost) > num(form.retPre) && (
                  <p className="soft-hint show">目前退休後報酬假設（{form.retPost}%）高於退休前（{form.retPre}%），請確認這是你的意思。</p>
                )}
                <div>
                  <button type="button" className="ghost small" onClick={resetAssumptions}>還原預設值</button>
                  <span className="note">（投資報酬 {paramValue("retPre")}%、退休後報酬 {paramValue("retPost")}%、薪資成長 {paramValue("salaryGrowth")}%）</span>
                </div>
              </div>
            </details>

            <details className="card" open>
              <summary>4. 投資標的：看看長期投資大盤型 ETF 能讓你提早幾年退休（選用）</summary>
              <div className="card-body">
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input type="checkbox" checked={form.assetsEnabled} onChange={(e) => set({ assetsEnabled: e.target.checked })} />
                  啟用後用下面的配置跑三種情境；關閉時使用第 3 區的單一報酬率
                </label>
                {form.assetsEnabled && (
                  <>
                    <p className="note">各標的報酬率皆為「假設值，非預測」，推算邏輯與來源見設定檔（每個欄位的來源欄）與 PARAMETERS.md。提到標的名稱只作為常見例子。美元計價標的（VOO、QQQ、美國公債）換算成新台幣報酬時只套用一次匯率調整；新台幣計價標的不套用。組合報酬率以每年固定比例再平衡簡化。三種情境的通膨率固定為保守 2.5%、中性 2%、樂觀 1.5%。</p>
                    <p className="note">{COMPLIANCE}</p>
                    <div className="grid2">
                      <div>
                        <label htmlFor="fxChange">新台幣對美元年變動率 <span className="unit-hint">（%／年）</span></label>
                        <input id="fxChange" type="number" inputMode="decimal" step="any" value={form.fxChange} onChange={(e) => set({ fxChange: e.target.value })} />
                        <p className="note">正值＝新台幣升值，美元資產換回新台幣的報酬變差；負值＝新台幣貶值，報酬變好。</p>
                      </div>
                    </div>

                    <h3 style={{ margin: "14px 0 6px" }}>退休前配置（%）</h3>
                    <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {ALLOCATION_PRESETS.map((pr) => (
                        <button key={pr.id} type="button" className="ghost small"
                          onClick={() => set({ allocation: Object.fromEntries(ASSETS.map((a) => [a.id, String(pr.alloc[a.id] ?? 0)])) })}>
                          {pr.label}
                        </button>
                      ))}
                    </div>
                    <table className="alloc-table"><tbody>
                      {ASSETS.map((a) => (
                        <tr key={a.id}>
                          <td style={{ minWidth: 170 }}>
                            <b>{a.label}</b> <span className="unit-hint">{a.currency === "USD" ? "美元計價" : "新台幣計價"}</span>
                            <span className="risk">{a.riskNote}</span>
                          </td>
                          {SCENARIO_IDS.map((sid) => (
                            <td key={sid}>
                              <label className="unit-hint" htmlFor={`ret-${a.id}-${sid}`}>{SCENARIO_LABELS[sid]}報酬%</label>
                              <input id={`ret-${a.id}-${sid}`} type="number" inputMode="decimal" step="any"
                                value={form.returnOverrides[a.id]?.[sid] ?? ""}
                                onChange={(e) => set({ returnOverrides: { ...form.returnOverrides, [a.id]: { ...form.returnOverrides[a.id], [sid]: e.target.value } } })} />
                            </td>
                          ))}
                          <td>
                            <label className="unit-hint" htmlFor={`alloc-${a.id}`}>配置%</label>
                            <input id={`alloc-${a.id}`} type="number" inputMode="decimal" step="any"
                              value={form.allocation[a.id] ?? "0"}
                              onChange={(e) => set({ allocation: { ...form.allocation, [a.id]: e.target.value } })} />
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                    {(() => {
                      const total = ASSETS.reduce((sum, a) => sum + num(form.allocation[a.id] ?? "0"), 0);
                      const concPct = num(form.allocation["qqq"] ?? "0");
                      return (
                        <>
                          <p className="note" aria-live="polite">配置總和：{fmtPlain(Math.round(total * 10) / 10)}%{Math.abs(total - 100) >= 1e-9 ? `（還差 ${fmtPlain(Math.round((100 - total) * 10) / 10)}%，總和為 100% 前暫停計算）` : ""}</p>
                          {concPct > paramValue("concentrationWarnPct") && concPct <= paramValue("concentrationStrongPct") && (
                            <p className="soft-hint show">集中風險提醒：QQQ 配置已超過 {paramValue("concentrationWarnPct")}%。QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大。</p>
                          )}
                          {concPct > paramValue("concentrationStrongPct") && (
                            <p className="soft-hint show warn-strong">集中風險提醒（明確）：QQQ 配置已超過 {paramValue("concentrationStrongPct")}%。QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大，請確認這是你的意思（不會阻止你繼續試算）。</p>
                          )}
                        </>
                      );
                    })()}

                    <h3 style={{ margin: "14px 0 6px" }}>退休後配置</h3>
                    <div className="seg" role="group" aria-label="退休後配置模式">
                      <button type="button" aria-pressed={form.retireAllocMode === "same"} onClick={() => set({ retireAllocMode: "same" })}>與退休前相同</button>
                      <button type="button" aria-pressed={form.retireAllocMode === "custom"} onClick={() => set({ retireAllocMode: "custom" })}>另一組配置</button>
                    </div>
                    {form.retireAllocMode === "same" ? (
                      <div style={{ marginTop: 8, maxWidth: 320 }}>
                        <label htmlFor="deduction">退休後保守折減 <span className="unit-hint">（百分點，下限為同情境定存報酬率）</span></label>
                        <input id="deduction" type="number" inputMode="decimal" step="any" value={form.deduction} onChange={(e) => set({ deduction: e.target.value })} />
                      </div>
                    ) : (
                      <table className="alloc-table" style={{ marginTop: 8 }}><tbody>
                        {ASSETS.map((a) => (
                          <tr key={a.id}>
                            <td><b>{a.label}</b></td>
                            <td>
                              <label className="unit-hint" htmlFor={`ralloc-${a.id}`}>退休後配置%</label>
                              <input id={`ralloc-${a.id}`} type="number" inputMode="decimal" step="any"
                                value={form.retireAllocation[a.id] ?? "0"}
                                onChange={(e) => set({ retireAllocation: { ...form.retireAllocation, [a.id]: e.target.value } })} />
                            </td>
                          </tr>
                        ))}
                      </tbody></table>
                    )}
                  </>
                )}
              </div>
            </details>

            <details className="card" open>
              <summary>5. 勞保與勞退（選用）</summary>
              <div className="card-body">
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input type="checkbox" checked={form.socialEnabled} onChange={(e) => set({ socialEnabled: e.target.checked })} />
                  納入勞保與勞退（關閉時不影響試算）
                </label>
                <p className="note">已預設納入勞保、勞退；不想納入可以取消勾選。</p>
                {form.socialEnabled && (
                  <>
                    <p className="note">勞保、勞退制度參數已依勞動部勞工保險局、全國法規資料庫公告核對（查證日 2026-11-17）；勞退基金收益率、年金打折等為假設值。法規可能變動，請以主管機關最新公告為準。</p>
                    <p className="note"><b>月收入請填扣掉勞退自提之後的實領金額</b>，自提部分會另外算進勞退帳戶，不會再從收入扣一次。</p>
                    <h3 style={{ margin: "12px 0 6px" }}>勞保老年年金</h3>
                    <div className="grid3">
                      <div><label htmlFor="liYears">目前已有勞保年資（年）</label><input id="liYears" type="number" inputMode="decimal" step="any" value={form.liExistingYears} onChange={(e) => set({ liExistingYears: e.target.value })} /></div>
                      <div>
                        <label htmlFor="liPlanned">預計投保年資（年）</label>
                        <input id="liPlanned" type="number" inputMode="decimal" step="any"
                          value={form.liPlannedManual ? form.liPlannedYears : String(num(form.liExistingYears) + Math.max(0, num(form.ageRetire) - num(form.ageNow)))}
                          onChange={(e) => set({ liPlannedYears: e.target.value, liPlannedManual: true })} />
                        {form.liPlannedManual && <button type="button" className="ghost small" onClick={() => set({ liPlannedManual: false, liPlannedYears: "" })}>恢復自動（已有年資＋工作年數）</button>}
                      </div>
                      <div>
                        <label htmlFor="liSalary">平均月投保薪資（元）</label>
                        <input id="liSalary" type="number" inputMode="decimal" step="any"
                          value={form.liSalaryManual ? form.liAvgSalary : String(bracketFor(num(form.monthlyIncome), LI_SALARY_BRACKETS, socialParamValue("liSalaryCap")))}
                          onChange={(e) => set({ liAvgSalary: e.target.value, liSalaryManual: true })} />
                        {form.liSalaryManual && <button type="button" className="ghost small" onClick={() => set({ liSalaryManual: false, liAvgSalary: "" })}>恢復依月薪級距</button>}
                        <p className="note">上限 {fmtPlain(socialParamValue("liSalaryCap"))} 元（假設參數）。</p>
                      </div>
                    </div>
                    <div className="grid3">
                      <div><label htmlFor="liClaim">請領年齡（歲）</label><input id="liClaim" type="number" inputMode="numeric" step="1" value={form.liClaimAge} onChange={(e) => set({ liClaimAge: e.target.value })} /></div>
                      <div>
                        <label htmlFor="liDiscount">年金給付打折（%）<span className="unit-hint">模擬勞保財務風險</span></label>
                        <input id="liDiscount" type="range" min="0" max="50" step="1" value={form.liDiscount} onChange={(e) => set({ liDiscount: e.target.value })} />
                        <span>{form.liDiscount}%</span>
                      </div>
                      <div>
                        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
                          <input type="checkbox" checked={form.liIndexed} onChange={(e) => set({ liIndexed: e.target.checked })} />
                          年金會隨通膨調整
                        </label>
                      </div>
                    </div>
                    {(() => {
                      const planned = form.liPlannedManual ? num(form.liPlannedYears) : num(form.liExistingYears) + Math.max(0, num(form.ageRetire) - num(form.ageNow));
                      return planned < socialParamValue("liMinYears") ? (
                        <p className="soft-hint show">年資可能不符合請領年金的條件（目前假設參數：需 {socialParamValue("liMinYears")} 年以上），請自行確認；下方仍顯示試算值，但不一定符合資格。</p>
                      ) : null;
                    })()}
                    {inp.social && computed?.res.socialDetail && (
                      <p className="note">試算：預計年資 {computed.res.socialDetail.liYears} 年，勞保月領（今日幣值，調整與打折後）約 {fmtPlain(Math.round(computed.res.socialDetail.liMonthlyToday))} 元。</p>
                    )}
                    <h3 style={{ margin: "14px 0 6px" }}>勞退新制</h3>
                    <div className="grid3">
                      <div>
                        <label htmlFor="lrWage">月提繳工資（元）</label>
                        <input id="lrWage" type="number" inputMode="decimal" step="any"
                          value={form.lrWageManual ? form.lrWage : String(bracketFor(num(form.monthlyIncome), LR_WAGE_BRACKETS, socialParamValue("lrWageCap")))}
                          onChange={(e) => set({ lrWage: e.target.value, lrWageManual: true })} />
                        {form.lrWageManual && <button type="button" className="ghost small" onClick={() => set({ lrWageManual: false, lrWage: "" })}>恢復依月薪級距</button>}
                        <p className="note">上限 {fmtPlain(socialParamValue("lrWageCap"))} 元（假設參數），上限不隨通膨調整。</p>
                      </div>
                      <div><label htmlFor="lrEmp">雇主提繳率（%）</label><input id="lrEmp" type="number" inputMode="decimal" step="any" value={form.lrEmployerRate} onChange={(e) => set({ lrEmployerRate: e.target.value })} /></div>
                      <div><label htmlFor="lrSelf">員工自提率（%，0–{socialParamValue("lrEmployeeMaxRate")}）</label><input id="lrSelf" type="number" inputMode="decimal" step="any" value={form.lrEmployeeRate} onChange={(e) => set({ lrEmployeeRate: e.target.value })} /></div>
                    </div>
                    <div className="grid3">
                      <div><label htmlFor="lrFund">勞退基金收益率（名目，%／年）</label><input id="lrFund" type="number" inputMode="decimal" step="any" value={form.lrFundReturn} onChange={(e) => set({ lrFundReturn: e.target.value })} /></div>
                      <div><label htmlFor="lrBal">目前個人帳戶累積（元）</label><input id="lrBal" type="number" inputMode="decimal" step="any" value={form.lrBalance} onChange={(e) => set({ lrBalance: e.target.value })} /></div>
                      <div><label htmlFor="lrClaim">勞退法定請領年齡（歲，假設參數）</label><input id="lrClaim" type="number" inputMode="numeric" step="1" value={form.lrClaimAge} onChange={(e) => set({ lrClaimAge: e.target.value })} /></div>
                      <div>
                        <label>請領方式</label>
                        <div className="seg" role="group" aria-label="勞退請領方式">
                          <button type="button" aria-pressed={form.lrMode === "lump"} onClick={() => set({ lrMode: "lump" })}>一次領</button>
                          <button type="button" aria-pressed={form.lrMode === "monthly"} onClick={() => set({ lrMode: "monthly" })}>月領</button>
                        </div>
                      </div>
                    </div>
                    {inp.social && laborPensionMonthlyEligibilityWarning(inp.social.laborPension, inp.ageNow, num(form.ageRetire)) && (
                      <p className="note">勞退提繳年資未滿 15 年，依規定只能一次領，以下月領金額僅供參考。（年資以現在到退休的年數近似，實際以勞保局紀錄為準。）</p>
                    )}
                    {inp.social && num(form.ageRetire) < num(form.lrClaimAge) && (
                      <p className="note">勞退個人帳戶通常需到法定年齡才能請領，退休到請領之間的支出會由你的資產支應。</p>
                    )}
                    {inp.social && computed?.res.socialDetail && (
                      <p className="note">試算：退休時勞退帳戶約 {fmtPlain(Math.round(computed.res.socialDetail.lpBalance))} 元（今日幣值），{computed.res.socialDetail.lpStartAge} 歲起領{form.lrMode === "monthly" ? `，月領約 ${fmtPlain(Math.round(computed.res.socialDetail.lpMonthlyAnnual / 12))} 元／月（以基金實質收益率年金化、領到預期壽命的簡化）` : computed.res.socialDetail.lpStartAge > num(form.ageRetire) ? `，一次領於 ${computed.res.socialDetail.lpStartAge} 歲併入資產（空窗期續以基金收益率累積）` : "，一次領併入退休時資產"}。勞退提領課稅不納入計算；健保費等請自行反映在退休支出中。</p>
                    )}
                  </>
                )}
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
            {computed && computed.scenarios ? (
              computed.scenarios.paused ? (
                <div className="card"><div className="card-body">
                  <p className="range-line">請先讓配置總和為 100%</p>
                  <p className="note">目前配置總和為 {fmtPlain(Math.round(computed.scenarios.allocationTotalPct * 10) / 10)}%，在總和達到 100% 前暫停計算，不會用不完整的配置繼續算。</p>
                </div></div>
              ) : (
                <ScenarioResults c={computed} scen={computed.scenarios} basis={basis} unit={unit} setBasis={setBasis} setUnit={setUnit} />
              )
            ) : computed ? <Results c={computed} basis={basis} unit={unit} setBasis={setBasis} setUnit={setUnit} onCsv={() => downloadCsv(computed)} /> : (
              <div className="card"><div className="card-body"><p className="note">請先修正左側輸入的提示，再查看試算結果。</p></div></div>
            )}
            {computed && !stale && (
              <>
                <InvestSection c={computed} basis={basis} unit={unit} />
                <GoalsCard c={computed} form={debounced} />
                <CompareCard c={computed} form={debounced} unit={unit} />
              </>
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
      <div className="summary-block">
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
              : (res.shortfall <= 0 ? "勞保、勞退和其他退休收入已足以支應退休支出（依目前假設）" : "無退休年數")}</div>
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
          <p className="print-only">主要假設：現在年齡 {A} 歲、預計退休 {R} 歲、預期壽命 {L} 歲；通膨率 2%（固定假設）、投資年化報酬率假設（名目）{inp.retPre}%、退休後年化報酬率假設（名目）{inp.retPost}%、薪資年成長率假設（名目）{inp.salaryGrowth}%。</p>
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

      {res.socialDetail && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h2>退休收入來源結構</h2></div>
          <div className="card-body">
            <IncomeStackChart res={res} unit={unit} />
            <p className="note">每一根柱是該年退休支出（今日幣值）的來源組成；紅色部分是需要由投資資產提領支應的缺口。</p>
          </div>
        </div>
      )}

      <details className="card" style={{ marginTop: 16 }}>
        <summary>逐年明細表</summary>
        <div className="card-body">
          <div className="actions no-print" style={{ marginBottom: 10 }}>
            <button type="button" className="ghost small" onClick={onCsv}>匯出 CSV（今日幣值，元）</button>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead><tr><th>年齡</th><th>年收入</th><th>年支出</th><th>年儲蓄</th><th>投資收益</th><th>年底資產</th>{inp.social && <><th>勞保年金</th><th>勞退月領</th><th>年支出缺口</th></>}</tr></thead>
              <tbody>
                {res.rows.map((row) => {
                  const cv = (v: number) => fmtNum(basis === "nominal" ? realToNominal(v, inp.inflation / 100, row.t) : v, unit);
                  return (
                    <tr key={row.age} className={row.phase === "retire" ? "retire-row" : row.phase === "now" ? "now-row" : ""}>
                      <td>{row.age}</td><td>{cv(row.income)}</td><td>{cv(row.expense)}</td>
                      <td>{cv(row.flow)}</td><td>{cv(row.gain)}</td><td>{cv(row.assets)}</td>
                      {inp.social && <><td>{row.phase === "retire" ? cv(row.li) : "—"}</td><td>{row.phase === "retire" ? cv(row.lp) : "—"}</td><td>{row.phase === "retire" ? cv(row.gap) : "—"}</td></>}
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
            <li>通膨率：2%（固定假設）</li>
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

function earliestText(e: EarliestResult, L: number): { main: string; sub: string } {
  if (e.type === "already") {
    return e.lastsToLife
      ? { main: "已退休，可撐到預期壽命", sub: `目前已是退休狀態，在這組假設下，資產可撐到預期壽命 ${L} 歲` }
      : { main: "已退休，資產不足以撐到預期壽命", sub: `目前已是退休狀態，但資產將在 ${e.exhaustAge} 歲耗盡，撐不到預期壽命 ${L} 歲` };
  }
  if (e.type === "age") return { main: `${e.age} 歲`, sub: "在這組假設下，資產可撐到預期壽命的最早退休年齡" };
  return { main: "無法達成", sub: `在目前假設下無法達成（試算到 ${paramValue("earliestRetirementCap")} 歲）` };
}

function ScenarioResults({ c, scen, basis, unit, setBasis, setUnit }: {
  c: Computed; scen: ScenariosOutcome; basis: Basis; unit: Unit;
  setBasis: (b: Basis) => void; setUnit: (u: Unit) => void;
}) {
  const [chartMode, setChartMode] = useState<"band" | "lines">("band");
  const [detailId, setDetailId] = useState<ScenarioId>("neutral");
  const byId = Object.fromEntries(scen.scenarios.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioOutcome>;
  const neu = byId.neutral, cons = byId.conservative, opt = byId.optimistic;
  const A = c.inp.ageNow, R = c.inp.ageRetire, L = c.inp.ageLife;
  const moneyOf = (sc: ScenarioOutcome) => (v: number, t: number) => fmtMoney(v, t, sc.inflationPct, basis, unit);
  const et = earliestText(neu.earliest, L);
  const detail = byId[detailId];
  const neutralExtra = neu.earliest.type === "none" ? findExtraSavingForEarliest(neu.inp) : null;

  const downloadScenCsv = () => {
    const head = "年齡,年收入(元，今日幣值),年支出(元，今日幣值),年儲蓄(元，今日幣值),投資收益(元，今日幣值),年底資產(元，今日幣值)\n";
    const lines = detail.res.rows.map((r) => [r.age, Math.round(r.income), Math.round(r.expense), Math.round(r.flow), Math.round(r.gain), Math.round(r.assets)].join(","));
    const blob = new Blob(["\uFEFF" + head + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `panda-finance-yearly-${detailId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <p className="range-line">
        保守到樂觀情境下，退休時資產約落在 {moneyOf(cons)(cons.res.retireAssets, R - A)} 到 {moneyOf(opt)(opt.res.retireAssets, R - A)} 之間{basisTag(basis)}。這是依假設值推算的區間，不是預測。
      </p>
      <div className="summary-block" style={{ marginTop: 12 }}>
        <div className="summary-grid">
          <div className="sum-card">
            <div className="k">退休時預估資產（中性情境）</div>
            <div className="v">{moneyOf(neu)(neu.res.retireAssets, R - A)}</div>
            <div className="s">保守 {moneyOf(cons)(cons.res.retireAssets, R - A)}／樂觀 {moneyOf(opt)(opt.res.retireAssets, R - A)}</div>
          </div>
          <div className="sum-card">
            <div className="k">退休所需資金（中性情境）</div>
            <div className="v">{neu.res.required > 0 ? moneyOf(neu)(neu.res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</div>
            <div className="s">{neu.res.required > 0 ? <>資金達成率 {fmtPct(neu.res.achieve)}</> : (neu.res.shortfall <= 0 ? "勞保、勞退和其他退休收入已足以支應退休支出（依目前假設）" : "無退休年數")}</div>
          </div>
          <div className="sum-card">
            <div className="k">最早可退休年齡（中性情境）</div>
            <div className="v" style={{ fontSize: neu.earliest.type === "already" ? "1.05rem" : undefined }}>{et.main}</div>
            <div className="s">{et.sub}</div>
          </div>
          <div className="sum-card">
            <div className="k">資產可撐到幾歲（中性情境）</div>
            <div className="v">{neu.res.exhaustAge === null ? `${L} 歲` : `${neu.res.exhaustAge} 歲耗盡`}</div>
            <div className="s">{neu.res.exhaustAge === null ? "可撐到預期壽命" : `資產在 ${neu.res.exhaustAge} 歲年底用完`}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>三種情境摘要</h2></div>
        <div className="card-body">
          <div className="toggle-row no-print">
            <span><span className="tg-label">金額口徑</span>
              <span className="seg" role="group" aria-label="金額口徑">
                <button type="button" aria-pressed={basis === "real"} onClick={() => setBasis("real")}>今日幣值</button>
                <button type="button" aria-pressed={basis === "nominal"} onClick={() => setBasis("nominal")}>名目</button>
              </span></span>
            <span><span className="tg-label">顯示單位</span>
              <span className="seg" role="group" aria-label="顯示單位">
                <button type="button" aria-pressed={unit === "wan"} onClick={() => setUnit("wan")}>萬元</button>
                <button type="button" aria-pressed={unit === "yuan"} onClick={() => setUnit("yuan")}>元</button>
              </span></span>
          </div>
          <p className="note">名目金額一律以「該情境自己的通膨率」換算。</p>
          <div className="table-scroll">
            <table className="scen-table">
              <thead><tr><th></th>{SCENARIO_IDS.map((id) => <th key={id}>{SCENARIO_LABELS[id]}（通膨 {byId[id].inflationPct}%、退休前報酬 {fmtRatePct(byId[id].preReturnPct / 100)}、退休後 {fmtRatePct(byId[id].postReturnPct / 100)}）</th>)}</tr></thead>
              <tbody>
                <tr><th>退休時資產</th>{SCENARIO_IDS.map((id) => <td key={id}>{moneyOf(byId[id])(byId[id].res.retireAssets, R - A)}</td>)}</tr>
                <tr><th>退休所需資金</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.required > 0 ? moneyOf(byId[id])(byId[id].res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</td>)}</tr>
                <tr><th>資金達成率</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.achieve === null ? "—" : fmtPct(byId[id].res.achieve)}</td>)}</tr>
                <tr><th>最早可退休年齡</th>{SCENARIO_IDS.map((id) => <td key={id}>{earliestText(byId[id].earliest, L).main}</td>)}</tr>
                <tr><th>資產耗盡年齡</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.exhaustAge === null ? `撐到 ${L} 歲` : `${byId[id].res.exhaustAge} 歲耗盡`}</td>)}</tr>
              </tbody>
            </table>
          </div>
          {neu.earliest.type === "none" && (
            <div className="note" style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 6px" }}>中性情境下最早可退休年齡無法達成。可以調整的方向包括：提高每月儲蓄、延後退休年齡、降低退休後支出、調整報酬假設值。</p>
              {neutralExtra?.found && (
                <p style={{ margin: 0 }}>用試算結果來看：若每月多存 {fmtPlain(neutralExtra.extraMonthly)} 元（今日幣值），中性情境下最早可於 {neutralExtra.earliestAge} 歲退休（其餘假設不變）。</p>
              )}
            </div>
          )}
          <p className="note" style={{ marginTop: 10 }}>{DISCLAIMER_SHORT}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>三情境資產曲線</h2></div>
        <div className="card-body">
          <div className="toggle-row no-print">
            <span><span className="tg-label">呈現方式</span>
              <span className="seg" role="group" aria-label="曲線呈現方式">
                <button type="button" aria-pressed={chartMode === "band"} onClick={() => setChartMode("band")}>區間帶</button>
                <button type="button" aria-pressed={chartMode === "lines"} onClick={() => setChartMode("lines")}>三條獨立線</button>
              </span></span>
          </div>
          <ScenarioChart scenarios={scen.scenarios} mode={chartMode} basis={basis} unit={unit}
            inflationByScenario={Object.fromEntries(scen.scenarios.map((x) => [x.id, x.inflationPct]))} />
        </div>
      </div>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>逐年明細表（三情境可切換）</summary>
        <div className="card-body">
          <div className="toggle-row no-print">
            <span><span className="tg-label">情境</span>
              <span className="seg" role="group" aria-label="明細情境">
                {SCENARIO_IDS.map((id) => (
                  <button key={id} type="button" aria-pressed={detailId === id} onClick={() => setDetailId(id)}>{SCENARIO_LABELS[id]}</button>
                ))}
              </span></span>
            <button type="button" className="ghost small" onClick={downloadScenCsv}>匯出 CSV（今日幣值，元）</button>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead><tr><th>年齡</th><th>年收入</th><th>年支出</th><th>年儲蓄</th><th>投資收益</th><th>年底資產</th>{detail.inp.social && <><th>勞保年金</th><th>勞退月領</th><th>年支出缺口</th></>}</tr></thead>
              <tbody>
                {detail.res.rows.map((row) => {
                  const cv = (v: number) => fmtNum(basis === "nominal" ? realToNominal(v, detail.inflationPct / 100, row.t) : v, unit);
                  return (
                    <tr key={row.age} className={row.phase === "retire" ? "retire-row" : row.phase === "now" ? "now-row" : ""}>
                      <td>{row.age}</td><td>{cv(row.income)}</td><td>{cv(row.expense)}</td>
                      <td>{cv(row.flow)}</td><td>{cv(row.gain)}</td><td>{cv(row.assets)}</td>
                      {detail.inp.social && <><td>{row.phase === "retire" ? cv(row.li) : "—"}</td><td>{row.phase === "retire" ? cv(row.lp) : "—"}</td><td>{row.phase === "retire" ? cv(row.gap) : "—"}</td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">金額單位：{unitWord(unit)}{basisTag(basis)}；名目以{SCENARIO_LABELS[detailId]}情境通膨 {detail.inflationPct}% 換算。退休期間的年儲蓄欄為每年支出缺口的負值。</p>
          <p className="note">組合報酬率：退休前 {fmtRatePct(detail.preReturnPct / 100)}／年、退休後 {fmtRatePct(detail.postReturnPct / 100)}／年（名目，匯率調整後加權）。</p>
        </div>
      </details>
    </>
  );
}

function GoalsCard({ c, form }: { c: Computed; form: FormState }) {
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [targetAge, setTargetAge] = useState(String(c.inp.ageRetire));
  const [targetSpend, setTargetSpend] = useState(String(c.inp.retireSpend));
  const [savingZ, setSavingZ] = useState(String(Math.round(c.monthlyBalance)));
  const scen = c.goalScen;
  const single = !form.assetsEnabled;
  const rowLabel = (key: string) => (key === "single" ? "目前假設（與主畫面相同）" : SCENARIO_LABELS[key as ScenarioId]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>目標反推</h2></div>
      <div className="card-body">
        <div className="seg no-print" role="group" aria-label="反推模式">
          <button type="button" aria-pressed={mode === 1} onClick={() => setMode(1)}>模式一：幾歲退休要存多少</button>
          <button type="button" aria-pressed={mode === 2} onClick={() => setMode(2)}>模式二：退休想領多少</button>
          <button type="button" aria-pressed={mode === 3} onClick={() => setMode(3)}>模式三：每月存 Z 元幾歲退休</button>
        </div>
        {single ? (
          <p className="note">以下答案使用與主畫面完全相同的假設（你輸入的退休前、退休後報酬率與通膨）。開啟『標的與配置』後，可看到保守、中性、樂觀三種情境的反推結果。反推與主畫面共用同一個模擬引擎。</p>
        ) : (
          <p className="note">以下答案都是「在目前所有假設下」的試算，依第 4 區的標的與情境設定分三種情境計算。反推與主畫面共用同一個模擬引擎。</p>
        )}
        {!single && scen.paused ? (
          <p className="range-line">請先讓配置總和為 100%（目前 {fmtPlain(Math.round(scen.allocationTotalPct * 10) / 10)}%），反推暫停計算。</p>
        ) : mode === 1 ? (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalAge">想在幾歲退休（歲）</label>
              <input id="goalAge" type="number" inputMode="numeric" step="1" value={targetAge} onChange={(e) => setTargetAge(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>每月至少要存</th><th>佔月收入</th><th>與目前結餘差距</th></tr></thead>
              <tbody>
                {goalSavingAnswers(form.assetsEnabled, c.inp, scen, num(targetAge)).map(({ key, sol }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{sol.found ? `${fmtPlain(sol.monthlySaving)} 元` : sol.reason}</td>
                      <td>{sol.found && sol.pctOfIncome !== null ? fmtPct(sol.pctOfIncome) : "—"}</td>
                      <td>{sol.found ? (sol.alreadyAchieved ? `目前已達成，餘裕 ${fmtPlain(Math.round(sol.surplus))} 元` : `還要多存 ${fmtPlain(Math.round(sol.gapVsCurrent))} 元`) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody></table>
          </>
        ) : mode === 2 ? (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalSpend">退休後每月想花（元，今日幣值）</label>
              <input id="goalSpend" type="number" inputMode="decimal" step="any" value={targetSpend} onChange={(e) => setTargetSpend(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>(a) 每月需要儲蓄</th><th>(b) 現在一次投入</th></tr></thead>
              <tbody>
                {goalSpendAnswers(form.assetsEnabled, c.inp, scen, num(targetSpend)).map(({ key, saving: a, lump: b }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{a.found ? `${fmtPlain(a.monthlySaving)} 元${a.alreadyAchieved ? "（目前已達成）" : ""}` : a.reason}</td>
                      <td>{b.found ? `${fmtPlain(b.lumpSum)} 元` : b.reason}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            <p className="note">(b) 是在每月儲蓄為 0、既有資產不變的前提下，現在需要一次投入的金額。</p>
          </>
        ) : (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalZ">每月可以存（元，今日幣值）</label>
              <input id="goalZ" type="number" inputMode="decimal" step="any" value={savingZ} onChange={(e) => setSavingZ(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>最早可退休年齡</th></tr></thead>
              <tbody>
                {goalEarliestAnswers(form.assetsEnabled, c.inp, scen, num(savingZ)).map(({ key, earliest: e }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{e.type === "age" ? `${e.age} 歲` : e.type === "already" ? (e.lastsToLife ? "已退休，可撐到預期壽命" : "已退休，資產不足以撐到預期壽命") : "在目前假設下無法達成"}</td>
                    </tr>
                  );
                })}
              </tbody></table>
          </>
        )}
      </div>
    </div>
  );
}

function CompareCard({ c, form, unit }: { c: Computed; form: FormState; unit: Unit }) {
  const [years, setYears] = useState(String(paramValue("goalCompareYears")));
  const [singleAsset, setSingleAsset] = useState("voo");
  const scen = c.goalScen;
  const byId = Object.fromEntries(scen.scenarios.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioOutcome>;
  const neuInp = byId.neutral?.inp ?? c.inp;
  const scenInf = Object.fromEntries(scen.scenarios.map((x) => [x.id, x.inflationPct])) as Record<ScenarioId, number>;
  const overrides = Object.fromEntries(Object.entries(form.returnOverrides).map(([k, rec]) => [k, Object.fromEntries(Object.entries(rec).map(([sid, v]) => [sid, num(v)])) as Record<ScenarioId, number>]));
  const nYears = Math.min(40, Math.max(1, num(years) || paramValue("goalCompareYears")));
  const compareRows = assetComparison(c.monthlyBalance, c.inp.initAssets, nYears, scenInf, overrides, num(form.fxChange));
  const allocSeries = (() => {
    if (scen.paused) return [];
    const mk = (alloc: Record<string, number>) => computeScenarios(c.inp, {
      allocation: alloc, retireAllocMode: form.retireAllocMode,
      retireAllocation: Object.fromEntries(Object.entries(form.retireAllocation).map(([k, v]) => [k, num(v)])),
      fxChangePct: num(form.fxChange), returnOverrides: overrides, scenarioInflation: scenInf,
      deductionPct: num(form.deduction),
    }).scenarios.find((x) => x.id === "neutral");
    const mine = byId.neutral;
    const single = mk({ [singleAsset]: 100 });
    const cash = mk({ cash: 100 });
    const pts = (o?: ScenarioOutcome) => (o ? o.res.rows.map((r) => ({ age: r.age, v: r.assets })) : []);
    return [
      { label: "我的配置（中性）", points: pts(mine), color: "#2e7d4f" },
      { label: `${ASSETS.find((a) => a.id === singleAsset)?.label ?? ""} 100%（中性）`, points: pts(single), color: "#3366aa", dash: "5 4" },
      { label: "定存 / 現金（中性）", points: pts(cash), color: "#c9a227", dash: "2 3" },
    ];
  })();
  const horizon = Math.max(1, c.inp.ageLife - c.inp.ageNow);
  const ppSeries = purchasingPowerSeries(1000000, c.inp.inflation, horizon);
  const ppAtRetire = nominalToReal(1000000, c.inp.inflation / 100, Math.max(0, c.inp.ageRetire - c.inp.ageNow));
  const variants = c.inp.social ? socialVariants(c.inp) : [];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>圖表比較</h2></div>
      <div className="card-body">
        <h3 style={{ margin: "6px 0" }}>各標的在假設報酬率下的資產比較</h3>
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="cmpYears">比較年數 N（年，1–40）</label>
          <input id="cmpYears" type="number" inputMode="numeric" step="1" value={years} onChange={(e) => setYears(e.target.value)} />
        </div>
        <p className="note">假設每月結餘 100% 投入單一標的，{nYears} 年後資產（實質口徑，今日幣值）。</p>
        <AssetRangeBars rows={compareRows.map((r) => ({ label: r.label, cons: r.values.conservative, neu: r.values.neutral, opt: r.values.optimistic }))} unit={unit} />
        <details>
          <summary>標的比較資料表</summary>
          <table className="scen-table"><thead><tr><th>標的</th><th>保守</th><th>中性</th><th>樂觀</th></tr></thead>
            <tbody>{compareRows.map((r) => (
              <tr key={r.assetId}><th>{r.label}</th><td>{fmtNum(r.values.conservative, unit)}</td><td>{fmtNum(r.values.neutral, unit)}</td><td>{fmtNum(r.values.optimistic, unit)}</td></tr>
            ))}</tbody></table>
        </details>

        <h3 style={{ margin: "16px 0 6px" }}>配置的資產曲線比較（中性情境）</h3>
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="cmpAsset">單一標的選擇</label>
          <select id="cmpAsset" value={singleAsset} onChange={(e) => setSingleAsset(e.target.value)}>
            {ASSETS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        {allocSeries.length ? <MultiLineChart series={allocSeries} unit={unit} /> : <p className="note">請先讓配置總和為 100%。</p>}

        <h3 style={{ margin: "16px 0 6px" }}>通膨影響對照</h3>
        <PurchasingPowerChart series={ppSeries} amount={1000000} unit={unit} />
        <p className="note">{Math.max(0, c.inp.ageRetire - c.inp.ageNow)} 年後的 100 萬（名目），實際購買力相當於今天的 {fmtNum(ppAtRetire, unit)} {unitWord(unit)}（以通膨 {c.inp.inflation}% 計算）。</p>

        <h3 style={{ margin: "16px 0 6px" }}>勞保勞退影響對照</h3>
        {variants.length ? (
          <table className="scen-table"><thead><tr><th>情況</th><th>最早可退休年齡</th><th>資產耗盡年齡</th></tr></thead>
            <tbody>{variants.map((v) => (
              <tr key={v.key}><th>{v.label}</th>
                <td>{v.earliest.type === "age" ? `${v.earliest.age} 歲` : v.earliest.type === "already" ? "已退休" : "無法達成"}</td>
                <td>{v.exhaustAge === null ? `撐到 ${c.inp.ageLife} 歲` : `${v.exhaustAge} 歲耗盡`}</td></tr>
            ))}</tbody></table>
        ) : (
          <p className="note">未納入勞保與勞退（第 5 區未啟用），本對照不適用。</p>
        )}
        <p className="note">{COMPLIANCE}</p>
      </div>
    </div>
  );
}

const DCA_COLORS = ["#2e7d4f", "#3366aa", "#c9a227", "#8e44ad", "#d35400", "#00838f", "#6d4c41", "#5d6d7e"];

/** Phase 4 第六、七節：投資對照卡 + 常見 ETF 定期定額比較（共用同一組定期定額欄位） */
function InvestSection({ c, basis, unit }: { c: Computed; basis: Basis; unit: Unit }) {
  const [monthlyStr, setMonthlyStr] = useState("");
  const [stepStr, setStepStr] = useState("");
  const [yearsStr, setYearsStr] = useState(String(paramValue("dcaCompareYears")));
  const inp = c.inp;
  const monthly = monthlyStr.trim() === "" ? Math.max(0, Math.round(c.monthlyBalance)) : num(monthlyStr);
  const stepPct = stepStr.trim() === "" ? inp.salaryGrowth : num(stepStr);
  const years = Math.min(50, Math.max(1, Math.floor(num(yearsStr)) || paramValue("dcaCompareYears")));
  const cashRet = ASSET_MAP["cash"].returns.neutral.value;
  const cmp = useMemo(
    () => investCompare({ base: inp, monthlyStart: monthly, stepPct, cashRetPct: cashRet }),
    [inp, monthly, stepPct, cashRet]
  );
  const money = (v: number, t: number) => fmtMoney(v, t, inp.inflation, basis, unit);
  const workYears = Math.max(0, inp.ageRetire - inp.ageNow);
  const dyn = cmp.dyn;
  const dynStatement = stepPct > 0 ? (
    <>這個結果假設你的定期定額金額會隨薪水每年調高 {fmtPlain(stepPct)}%：第 1 年每月 {fmtPlain(dyn.aMonthly)} 元 → 第 {dyn.years} 年每月約 {fmtPlain(Math.round(dyn.lastMonthlyNominal))} 元（今日幣值約 {fmtPlain(Math.round(dyn.lastMonthlyReal))} 元）。你必須真的每年跟著加碼，才會得到這個金額；如果金額一直不變，結果會是 {fmtPlain(Math.round(dyn.fixedRetireAssetsReal))} 元（今日幣值）／{fmtPlain(Math.round(dyn.fixedRetireAssetsNominal))} 元（名目）。</>
  ) : (
    <>這個結果假設你每月固定投入 {fmtPlain(dyn.aMonthly)} 元，不調高。</>
  );
  const earliestCell = (e: number | null) => (e === null ? "無法達成" : `${e} 歲`);
  const cellText = (cell: { retireAssets: number; earliest: number | null }) => (
    <>{money(cell.retireAssets, workYears)}<br /><span className="unit-hint">最早 {earliestCell(cell.earliest)} 可退休</span></>
  );

  const etfRows = ASSETS.map((a) => {
    const pair = dcaPair({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.neutral.value, inflationPct: inp.inflation, years });
    const cons = dca({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.conservative.value, inflationPct: inp.inflation, years });
    const opt = dca({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.optimistic.value, inflationPct: inp.inflation, years });
    return { a, pair, cons, opt };
  });
  const pick = (real: number, nominal: number) => (basis === "nominal" ? nominal : real);
  const chartSeries = etfRows.map((r, i) => ({
    label: r.a.id === "cash" ? "定存（基準）" : r.a.label,
    color: DCA_COLORS[i % DCA_COLORS.length],
    points: [{ age: 0, v: 0 }, ...r.pair.stepped.curve.map((pt) => ({ age: pt.t, v: pick(pt.valueReal, pt.valueNominal) }))],
  }));

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>每月定期定額投資 vs 全部放定存</h2></div>
        <div className="card-body">
          <div className="grid2">
            <div>
              <label htmlFor="dcaMonthly">每月定期定額金額 <span className="unit-hint">（元，今日幣值）</span></label>
              <input id="dcaMonthly" type="number" inputMode="decimal" step="any" placeholder={String(Math.max(0, Math.round(c.monthlyBalance)))} value={monthlyStr} onChange={(e) => setMonthlyStr(e.target.value)} />
              <p className="note">留空＝使用目前每月結餘 {fmtPlain(Math.max(0, Math.round(c.monthlyBalance)))} 元。</p>
            </div>
            <div>
              <label htmlFor="dcaStep">每年調高幅度 <span className="unit-hint">（%，填 0 表示金額固定不變）</span></label>
              <input id="dcaStep" type="number" inputMode="decimal" step="any" placeholder={String(inp.salaryGrowth)} value={stepStr} onChange={(e) => setStepStr(e.target.value)} />
              <p className="note">留空＝使用薪資成長率 {fmtPlain(inp.salaryGrowth)}%。</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="scen-table">
              <thead><tr><th></th><th>每年加碼</th><th>固定金額</th></tr></thead>
              <tbody>
                <tr><th>全部放定存（{fmtPlain(cashRet)}%）</th><td>{cellText(cmp.cashStepped)}</td><td>{cellText(cmp.cashFixed)}</td></tr>
                <tr><th>大盤型 ETF 為主的組合（第 3 區報酬率）</th><td>{cellText(cmp.marketStepped)}</td><td>{cellText(cmp.marketFixed)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="note">同樣每月投入，大盤型 ETF 組合退休時比定存多約 {fmtNum(cmp.gapAssets, "wan")} 萬元{cmp.gapYears !== null && cmp.gapYears !== 0 ? `，最早可退休年齡早 ${cmp.gapYears} 歲` : ""}（假設值試算）。</p>
          <p className="note">越早開始差越多：如果晚 {cmp.delayYears} 年才開始投資（前 {cmp.delayYears} 年先放定存，之後才投資），退休時資產約少 {fmtNum(cmp.delayGapAssets, "wan")} 萬元。{cmp.delayIsHalf ? "（工作年數不到 10 年，這裡以晚一半年數計算。）" : ""}</p>
          <div className="callout">{dynStatement}</div>
          <p className="note">主畫面摘要用的是『收入 − 支出』的實際結餘，這張卡用你設定的定期定額金額，所以數字可能和上方略有不同。主畫面的模型是「每月結餘 = 收入（隨薪資成長）− 支出（今日幣值固定）」，結餘每年增加的幅度比薪資成長率快；定期定額模組則是「每月投入金額依你設定的幅度調高」，兩者口徑不同。</p>
          <p className="note">{COMPLIANCE}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>常見 ETF 每月定期定額 {years} 年試算比較</h2></div>
        <div className="card-body">
          <div style={{ maxWidth: 260 }}>
            <label htmlFor="dcaYears">試算年限 <span className="unit-hint">（年，1–50）</span></label>
            <input id="dcaYears" type="number" inputMode="numeric" step="1" value={yearsStr} onChange={(e) => setYearsStr(e.target.value)} />
          </div>
          <p className="note">每月金額與每年調高幅度使用上方投資對照卡的同一組欄位（每月 {fmtPlain(monthly)} 元、每年調高 {fmtPlain(stepPct)}%）。</p>
          <div className="callout">{dynStatement}</div>
          <p className="note">試算一律使用本站的假設報酬（推算邏輯見 PARAMETERS.md），不是各 ETF 的歷史報酬；歷史報酬欄只是參考，成立時間短的參考價值更低。</p>
          <p className="note">{COMPLIANCE}</p>
          <div className="table-scroll">
            <table className="scen-table etf-table">
              <thead><tr>
                <th>名稱</th><th>類型</th><th>成立年份</th><th>總費用率（2025 年度）</th><th>中性假設年化報酬</th>
                <th>累積投入本金（{basis === "nominal" ? "名目" : "今日幣值"}）</th><th>{years} 年後（每年加碼）</th><th>{years} 年後（固定金額）</th>
                <th>保守–樂觀區間（每年加碼）</th><th>成立以來實際含息年化（參考）</th><th>風險提示</th>
              </tr></thead>
              <tbody>
                {etfRows.map(({ a, pair, cons, opt }) => (
                  <tr key={a.id}>
                    <th>{a.id === "cash" ? "定存（基準）" : a.label}</th>
                    <td>{a.category}</td>
                    <td>{a.inceptionDate ? a.inceptionDate.slice(0, 4) : "—"}</td>
                    <td>{a.expenseRatioPct !== null ? `${a.expenseRatioPct}%` : "—"}</td>
                    <td>{fmtPlain(a.returns.neutral.value)}%</td>
                    <td>{fmtNum(pick(pair.stepped.principalReal, pair.stepped.principalNominal), unit)}</td>
                    <td>{fmtNum(pick(pair.stepped.fvReal, pair.stepped.fvNominal), unit)}</td>
                    <td>{fmtNum(pick(pair.fixed.fvReal, pair.fixed.fvNominal), unit)}</td>
                    <td>{fmtNum(pick(cons.fvReal, cons.fvNominal), unit)} – {fmtNum(pick(opt.fvReal, opt.fvNominal), unit)}</td>
                    <td>{a.histAnnualPct !== null && a.histYears !== null
                      ? <>{fmtPlain(a.histAnnualPct)}%（成立 {a.histYears} 年，僅供參考）{a.histYears < 10 ? "；歷史太短，未經歷完整多空循環" : ""}{a.histExtra ? `；${a.histExtra}` : ""}</>
                      : "—"}</td>
                    <td className="risk-cell">{a.riskNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">金額單位：{unitWord(unit)}（{basis === "nominal" ? "名目" : "今日幣值"}）。</p>
          <h3 style={{ margin: "14px 0 6px" }}>累積曲線（中性、每年加碼）</h3>
          <div className="legend">
            {chartSeries.map((s) => <span key={s.label}><i className="sw" style={{ background: s.color }} />{s.label}</span>)}
          </div>
          <MultiLineChart series={chartSeries} unit={unit} />
          <h3 style={{ margin: "16px 0 6px" }}>為什麼大盤型 ETF 常被拿來定期定額</h3>
          <p className="note">大盤型（市值型）ETF 一次買進一整個市場的大型公司，不用自己選股，成分股會定期調整，內扣費用通常也比較低。定期定額是每個月固定投入，漲的時候買到的單位少、跌的時候買到的單位多，不用猜進場時間。短期一定會遇到下跌，有時跌幅很大；長期持有、持續投入，才有機會接近長期平均報酬，但沒有任何保證，也可能虧損。高股息型和產業集中型 ETF 各有不同的風險與成本，請看表格的風險提示。</p>
          <p className="note">{COMPLIANCE}</p>
        </div>
      </div>
    </>
  );
}
