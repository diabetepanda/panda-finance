// ui/printDetails.ts｜列印時展開 details 的狀態管理（純函式，可測）
// 只有在尚未記錄原狀態時才記錄，避免 beforeprint 重複觸發把「已展開」誤記為原狀態。
export interface Openable { open: boolean }

/** 記錄目前 open 狀態並全部展開；已記錄過（saved 非 null）時直接回傳原記錄、不再覆寫 */
export function snapshotAndOpenAll<T extends Openable>(items: T[], saved: boolean[] | null): boolean[] {
  if (saved !== null) return saved;
  const snap = items.map((el) => el.open);
  items.forEach((el) => { el.open = true; });
  return snap;
}

/** 依記錄恢復 open 狀態；回傳 null 表示記錄已清除 */
export function restoreAll<T extends Openable>(items: T[], saved: boolean[] | null): null {
  if (saved !== null) {
    items.forEach((el, idx) => { if (idx < saved.length) el.open = saved[idx]; });
  }
  return null;
}
