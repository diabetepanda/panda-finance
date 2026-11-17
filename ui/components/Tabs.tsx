// ui/components/Tabs.tsx｜分頁列（role=tablist，鍵盤左右鍵切換；不浮動）
import { useRef } from "react";

export interface TabDef { id: string; label: string; }

export default function Tabs({ tabs, active, onChange }: {
  tabs: TabDef[]; active: string; onChange: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, idx: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    if (next !== null) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div className="tablist" role="tablist" aria-label="結果分頁">
      {tabs.map((t, i) => (
        <button key={t.id} type="button" role="tab" id={`tab-${t.id}`}
          ref={(el) => { refs.current[i] = el; }}
          aria-selected={active === t.id} aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className={`tab-btn${active === t.id ? " current" : ""}`}
          onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
