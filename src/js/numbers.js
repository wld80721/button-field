const wholeNumbers = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const smallRates = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const counts = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const suffixes = ["", "K", "M", "B", "T"];

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1000) return wholeNumbers.format(Math.trunc(n));
  if (Math.abs(n) >= 1e15) {
    // Keep the displayed precision below the next power of ten.
    const [mantissa, exponent] = n.toExponential().split("e");
    const truncated = Number(mantissa.match(/^-?\d(?:\.\d{1,2})?/)[0]);
    return truncated + "e" + exponent;
  }
  let unit = suffixes.length - 1;
  while (Math.abs(n) < 1000 ** unit) unit--;
  const scaled = n / 1000 ** unit;
  const precision = Math.abs(scaled) >= 100 ? 1 : 10;
  return Math.trunc(scaled * precision) / precision + suffixes[unit];
}

function fmtRate(n) {
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) < 1000 ? smallRates.format(n) : fmt(n);
}

function fmtExact(n) {
  return Number.isFinite(n) ? counts.format(n) : "—";
}

export { fmt, fmtExact, fmtRate };
