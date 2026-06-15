export function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00";
  const safeValue = Object.is(value, -0) ? 0 : value;
  return safeValue.toFixed(2);
}
