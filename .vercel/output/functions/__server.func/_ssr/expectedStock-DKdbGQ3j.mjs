function classifyDiscrepancy(diff) {
  if (Math.abs(diff) < 1e-9) return "match";
  return diff < 0 ? "shortage" : "surplus";
}
export {
  classifyDiscrepancy
};
