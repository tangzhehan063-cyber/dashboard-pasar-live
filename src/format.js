const nf = (d) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });

export function idrShort(v) {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e9) return s + "Rp" + nf(2).format(a / 1e9) + " M";
  if (a >= 1e6) return s + "Rp" + nf(2).format(a / 1e6) + " jt";
  if (a >= 1000) return s + "Rp" + nf(0).format(a);
  return s + "Rp" + nf(a < 10 ? 2 : 0).format(a);
}
export const idr = (v) => (v == null || !isFinite(v) ? "—" : (v < 0 ? "−" : "") + "Rp" + nf(Math.abs(v) < 10 ? 2 : 0).format(Math.abs(v)));
export const usd = (v) => (v == null || !isFinite(v) ? "—" : (v < 0 ? "−" : "") + "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v)));
export const pct = (v) => (v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + nf(2).format(Math.abs(v)) + "%");
export const qty = (v) => (v == null ? "—" : nf(v < 1 ? 8 : 4).format(v).replace(/,?0+$/, ""));
export const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
export const dateShort = (d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
