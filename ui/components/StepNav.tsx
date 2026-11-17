// ui/components/StepNav.tsx｜4 步驟列（不浮動；目前步驟醒目、已填過加勾號）
export const STEP_LABELS = ["關於你", "每個月的錢", "勞保勞退與其他收入", "結果"] as const;

export default function StepNav({ step, visited, onGo }: {
  step: number; visited: number[]; onGo: (n: number) => void;
}) {
  return (
    <nav className="stepnav" aria-label="步驟">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = visited.includes(n) && n !== step;
        return (
          <button key={n} type="button" className={`step-tab${n === step ? " current" : ""}`}
            aria-current={n === step ? "step" : undefined} onClick={() => onGo(n)}>
            <span className="step-num">{done ? "✓" : n}</span> {label}
          </button>
        );
      })}
    </nav>
  );
}
