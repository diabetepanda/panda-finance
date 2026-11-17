// ui/steps/stepHelpers.tsx｜步驟元件共用小工具
import type { SimInput } from "../../core/simulate";
import { salaryRealGrowth } from "../../core/compute";
import { nominalToReal } from "../../core/rates";
import { fmtPlain, fmtRatePct } from "../format";

export { defaultRetireSpend } from "../../core/retirement";

/** 「薪水有沒有跑贏通膨」說明段（Phase 5 起放在步驟 ② 的進階裡，內容沿用舊版） */
export function salaryRealGrowthNote(inp: SimInput) {
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
}
