// ============================================================
// 支出類別（規格第 5.6 節）｜Phase 2 分類通膨
// ============================================================

export type CategoryId = "housing" | "food" | "medical" | "other";

export interface CategoryDef { id: CategoryId; label: string; }

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: "housing", label: "房租房貸" },
  { id: "food", label: "伙食" },
  { id: "medical", label: "醫療與保險" },
  { id: "other", label: "其他" },
];

export const CATEGORY_IDS: CategoryId[] = EXPENSE_CATEGORIES.map((c) => c.id);

/** 預設支出欄位名稱 → 類別的預設對應（第 5.6 節：預設欄位先對應好） */
export const DEFAULT_EXPENSE_CATEGORY: Record<string, CategoryId> = {
  "房租或房貸": "housing",
  "伙食": "food",
  "交通": "other",
  "水電網路": "other",
  "保險": "medical",
  "娛樂": "other",
  "其他": "other",
};

export function defaultCategoryFor(name: string): CategoryId {
  return DEFAULT_EXPENSE_CATEGORY[name] ?? "other";
}
