/**
 * Учётный остаток (expected stock) хранится в таблице public.expected_items
 * и заполняется бухгалтером — вручную или импортом Excel.
 * Здесь только утилиты классификации расхождений.
 */
export type DiscrepancyStatus = "match" | "shortage" | "surplus";

export function classifyDiscrepancy(diff: number): DiscrepancyStatus {
  if (Math.abs(diff) < 1e-9) return "match";
  return diff < 0 ? "shortage" : "surplus";
}
