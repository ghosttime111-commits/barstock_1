export function formatQuantity(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  const safeValue = Object.is(rounded, -0) ? 0 : rounded;
  return safeValue.toFixed(3).replace(/\.?0+$/, "");
}
