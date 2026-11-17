// ui/App.tsx｜外殼：form 狀態、debounce、validation、compute、步驟切換（Phase 5）
// 欄位與結果分別在 ui/steps/* 與 ui/results/ResultsPage.tsx；計算一律在 core/。
import { useEffect, useMemo, useRef, useState } from "react";
import { validateInput, type ValidationResult } from "../core/validate";
import { pickKnownFields, migrateLegacyForm, sanitizeLifeGoals } from "../core/importForm";
import { shortConclusionLine } from "../core/conclusion";
import { paramValue } from "../config/defaults";
import type { Basis, Unit } from "./format";
import { defaultForm, toInput, compute, num, type FormState, type Computed } from "./form";
import StepNav from "./components/StepNav";
import { snapshotAndOpenAll, restoreAll } from "./printDetails";
import StepBasic from "./steps/StepBasic";
import StepCashflow from "./steps/StepCashflow";
import StepSocial from "./steps/StepSocial";
import ResultsPage from "./results/ResultsPage";

export default function App() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [debounced, setDebounced] = useState<FormState>(form);
  const [basis, setBasis] = useState<Basis>("real");
  const [unit, setUnit] = useState<Unit>("wan");
  const [exampleActive, setExampleActive] = useState(true);
  const [importMsg, setImportMsg] = useState("");
  const [step, setStep] = useState(1);
  const [visited, setVisited] = useState<number[]>([1]);
  const [howToOpen, setHowToOpen] = useState(false);
  const lastValid = useRef<Computed | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(form), paramValue("debounceMs"));
    return () => clearTimeout(id);
  }, [form]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    navRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  // 列印時展開所有收合區塊（逐年明細、計算說明等），印完恢復原狀態。
  // snapshotAndOpenAll 只在尚未記錄時才記錄，避免重複觸發把已展開誤記為原狀態；
  // matchMedia('print') 的 change 作為不觸發 beforeprint/afterprint 的瀏覽器的備援。
  useEffect(() => {
    let saved: boolean[] | null = null;
    const details = () => Array.from(document.querySelectorAll("details"));
    const before = () => { saved = snapshotAndOpenAll(details(), saved); };
    const after = () => { saved = restoreAll(details(), saved); };
    const mq = window.matchMedia("print");
    const onMq = (e: MediaQueryListEvent) => { if (e.matches) before(); else after(); };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const inp = useMemo(() => toInput(debounced), [debounced]);
  const validation: ValidationResult = useMemo(() => validateInput(inp), [inp]);
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

  const goStep = (n: number) => {
    setStep(n);
    setVisited((v) => (v.includes(n) ? v : [...v, n]));
  };
  const openHowTo = () => { setHowToOpen(true); goStep(3); };

  const clearAmounts = () => {
    setForm((f) => ({
      ...f,
      initAssets: "0", otherRetireIncome: "0", monthlyIncome: "0",
      expenses: f.expenses.map((e) => ({ ...e, amount: "0" })),
      retireSpend: "0", retireManual: true,
    }));
    setExampleActive(false);
  };

  const resetAssumptions = () => set({
    retPre: String(paramValue("retPre")),
    retPost: String(paramValue("retPost")),
    salaryGrowth: String(paramValue("salaryGrowth")),
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: "panda-finance", version: 3, form }, null, 2)], { type: "application/json" });
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
        const raw = data.form as Record<string, unknown>;
        if (!raw || typeof raw.ageNow !== "string" || !Array.isArray(raw.expenses)) throw new Error("bad");
        // Phase 5：先跑舊檔轉換（socialEnabled 等），再只保留目前 FormState 的欄位
        // Phase 6：舊檔（version 2 或沒有 lifeGoals）→ lifeGoals 維持預設 []；逐筆檢查，格式不對的略過
        const migrated = migrateLegacyForm(raw);
        const picked = pickKnownFields(migrated, defaultForm() as unknown as Record<string, unknown>) as unknown as FormState;
        const sanitized = sanitizeLifeGoals(picked.lifeGoals);
        picked.lifeGoals = sanitized.goals as FormState["lifeGoals"];
        setForm(picked);
        setExampleActive(false);
        setImportMsg(sanitized.skipped > 0 ? `有 ${sanitized.skipped} 筆大目標格式不正確，已略過` : "");
      } catch {
        setImportMsg("設定檔格式不正確，無法匯入，原來的數字沒有被改動。");
      }
    });
  };

  const downloadCsv = (c: Computed) => {
    const hasGoals = (c.inp.lifeGoals?.length ?? 0) > 0;
    const head = "年齡,年收入(元，今日幣值),年支出(元，今日幣值),年儲蓄(元，今日幣值),投資收益(元，今日幣值),年底資產(元，今日幣值)" + (hasGoals ? ",大目標一次支出(元，今日幣值),貸款還款(元/年，今日幣值)" : "") + "\n";
    const lines = c.res.rows.map((r) => [r.age, Math.round(r.income), Math.round(r.expense), Math.round(r.flow), Math.round(r.gain), Math.round(r.assets), ...(hasGoals ? [Math.round(r.goalLump), Math.round(r.goalPay)] : [])].join(","));
    const blob = new Blob(["\uFEFF" + head + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "panda-finance-yearly.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // 步驟頁底部「目前試算」小字：三情境啟用時用中性情境
  const footerLine = (() => {
    if (!computed) return "";
    const scen = computed.scenarios && !computed.scenarios.paused ? computed.scenarios : null;
    const neu = scen ? scen.scenarios.find((x) => x.id === "neutral")! : null;
    return shortConclusionLine({
      earliest: neu ? neu.earliest : computed.earliest,
      res: neu ? neu.res : computed.res,
      retireAge: computed.inp.ageRetire, lifeExpectancy: computed.inp.ageLife,
      cap: paramValue("earliestRetirementCap"), scenario: !!neu,
    });
  })();

  return (
    <>
      <div className="privacy-bar">你的資料只在這個瀏覽器中計算，不會被上傳或儲存</div>
      <div className="wrap">
        <header className="site-head">
          <h1>Panda Finance</h1>
          <p className="subtitle">台灣上班族理財規劃與退休試算</p>
        </header>

        <div ref={navRef} className={`stepnav-wrap ${step === 4 ? "navwrap-results" : "navwrap-steps"}`}>
          <StepNav step={step} visited={visited} onGo={goStep} />
        </div>

        {step < 4 && (
          <div className="step-page">
            {exampleActive && step === 1 && (
              <div className="example-banner no-print">
                <span>這是範例（30 歲、實領月薪 5 萬、剛開始工作），請改成你自己的數字。</span>
                <button type="button" className="ghost small" style={{ background: "transparent" }} onClick={clearAmounts}>一鍵清空金額</button>
              </div>
            )}
            {step === 1 && <StepBasic form={form} set={set} ageErrors={validation.ageErrors} />}
            {step === 2 && <StepCashflow form={form} set={set} inp={inp} incomeErrors={validation.incomeErrors} />}
            {step === 3 && <StepSocial form={form} set={set} inp={inp} computed={computed} howToOpen={howToOpen} setHowToOpen={setHowToOpen} />}
            {validation.basicErrors.length > 0 && step === 1 && (
              <p className="msg show">{validation.basicErrors.map((m, i) => <span key={i}>{m}<br /></span>)}</p>
            )}
            {footerLine && <p className="current-line">目前試算：{footerLine}</p>}
            <div className="step-actions no-print">
              {step > 1 && <button type="button" className="ghost" onClick={() => goStep(step - 1)}>上一步</button>}
              {step < 3 && <button type="button" onClick={() => goStep(step + 1)}>下一步</button>}
              <button type="button" className={step === 3 ? "" : "ghost"} onClick={() => goStep(4)}>直接看結果</button>
            </div>
          </div>
        )}

        <div className={step === 4 ? "results-wrap" : "results-wrap offscreen"} aria-hidden={step !== 4}>
          <ResultsPage
            c={computed}
            formDb={debounced}
            formLive={form}
            set={set}
            validation={validation}
            basis={basis} unit={unit}
            setBasis={setBasis} setUnit={setUnit}
            stale={stale}
            exampleActive={exampleActive}
            onClearAmounts={clearAmounts}
            onExport={exportJson}
            onImport={importJson}
            importMsg={importMsg}
            onCsv={() => { if (computed) downloadCsv(computed); }}
            onGoStep={goStep}
            onOpenHowTo={openHowTo}
            onResetAssumptions={resetAssumptions}
          />
        </div>
      </div>
    </>
  );
}
