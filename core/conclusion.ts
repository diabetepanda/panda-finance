// core/conclusion.ts｜白話結論句（規格 Phase 5 第六節）
// 純函式。結果頁的大字結論與步驟頁底部「目前試算」小字都由這裡產生。

import type { EarliestResult } from "./retirement";
import type { SimResult } from "./simulate";

export interface ConclusionInput {
  earliest: EarliestResult;
  res: SimResult;
  retireAge: number;
  lifeExpectancy: number;
  cap: number; // earliestRetirementCap（試算上限年齡）
  scenario?: boolean; // 三情境模式時，句尾加「（中性情境）」
  finalAssetsText?: string; // 預期壽命時剩餘資產的顯示字串（由 UI 依口徑/單位格式化後傳入）
}

/** 結果頁大字結論（第六節第 2 點的句型） */
export function plainConclusion(i: ConclusionInput): string {
  const L = i.lifeExpectancy;
  let s: string;
  if (i.earliest.type === "already") {
    // 沿用 Phase 4.1 的 earliestMain／earliestSub 說法
    s = i.earliest.lastsToLife
      ? `已退休，可撐到預期壽命。目前已是退休狀態，在這組假設下，資產可撐到預期壽命 ${L} 歲。`
      : `已退休，資產不足以撐到預期壽命。目前已是退休狀態，但資產將在 ${i.earliest.exhaustAge} 歲耗盡，撐不到預期壽命 ${L} 歲。`;
  } else if (i.earliest.type === "age") {
    const first = `照目前的存法，你最早大約 ${i.earliest.age} 歲就能退休。`;
    const second = i.res.exhaustAge === null
      ? (i.finalAssetsText
          ? `你預計 ${i.retireAge} 歲退休，到 ${L} 歲時還會剩約 ${i.finalAssetsText}。`
          : `你預計 ${i.retireAge} 歲退休，資產可以撐到 ${L} 歲。`)
      : `你預計 ${i.retireAge} 歲退休，資產會在 ${i.res.exhaustAge} 歲用完。`;
    s = first + second;
  } else {
    s = `照目前的存法，到 ${i.cap} 歲前都還不能安心退休。可以到下方『怎麼改善』看看要多存多少。`;
  }
  return i.scenario ? s + "（中性情境）" : s;
}

/** 步驟頁底部「目前試算：……」小字的內容部分 */
export function shortConclusionLine(i: ConclusionInput): string {
  const L = i.lifeExpectancy;
  let s: string;
  if (i.earliest.type === "already") {
    s = i.earliest.lastsToLife
      ? `已退休，資產可撐到 ${L} 歲。`
      : `已退休，資產會在 ${i.earliest.exhaustAge} 歲用完。`;
  } else if (i.earliest.type === "age") {
    s = `最早約 ${i.earliest.age} 歲可以退休。`;
  } else {
    s = `到 ${i.cap} 歲前還不能安心退休。`;
  }
  return i.scenario ? s + "（中性情境）" : s;
}
