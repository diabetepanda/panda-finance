// core/importForm.ts｜JSON 匯入的欄位過濾（規格 Phase 4 第四節）
// 純函式：只保留範本（目前 FormState）存在的欄位，舊版設定檔多出的
// 已刪除欄位（例如 inflation、categoryEnabled）直接忽略，不報錯；
// 缺少的欄位保留範本預設值。

export function pickKnownFields<T extends Record<string, unknown>>(source: unknown, template: T): T {
  const out: Record<string, unknown> = { ...template };
  if (source !== null && typeof source === "object") {
    for (const key of Object.keys(template)) {
      if (key in (source as Record<string, unknown>)) {
        out[key] = (source as Record<string, unknown>)[key];
      }
    }
  }
  return out as T;
}

/**
 * 舊版設定檔轉換（規格 Phase 5 第八節第 4 點），在 pickKnownFields 之前執行：
 * - 有 socialEnabled 且沒有 laborInsured：true → laborInsured "yes" + 手動模式
 *   （舊檔的勞保勞退是自己填的，用手動模式結果才會和舊版一致）；false → "no"。
 * - 任一筆支出有 endAge → showExpenseEndAge true。
 * 其他欄位原樣交給 pickKnownFields，未知欄位照舊忽略。
 */
export function migrateLegacyForm(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  if ("socialEnabled" in out && !("laborInsured" in out)) {
    if (out.socialEnabled === true) {
      out.laborInsured = "yes";
      out.socialInputMode = "manual";
    } else if (out.socialEnabled === false) {
      out.laborInsured = "no";
    }
    delete out.socialEnabled;
  }
  if (Array.isArray(out.expenses)) {
    const hasEnd = out.expenses.some(
      (e) => e !== null && typeof e === "object" && String((e as Record<string, unknown>).endAge ?? "").trim() !== ""
    );
    if (hasEnd) out.showExpenseEndAge = true;
  }
  return out;
}
