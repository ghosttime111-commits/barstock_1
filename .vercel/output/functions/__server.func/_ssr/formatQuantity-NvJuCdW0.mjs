function formatQuantity(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const rounded = Math.round((value + Number.EPSILON) * 1e3) / 1e3;
  const safeValue = Object.is(rounded, -0) ? 0 : rounded;
  return safeValue.toFixed(3).replace(/\.?0+$/, "");
}
export {
  formatQuantity as f
};
