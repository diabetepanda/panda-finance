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
