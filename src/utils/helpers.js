/* --------------------------------- helpers -------------------------------- */

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function fmt(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

export function hashColorClasses(str) {
  const arr = ["bg-accent/12 text-accent-hover", "bg-sky-500/15 text-sky-300", "bg-emerald-500/15 text-emerald-300", "bg-white/5 text-subtext", "bg-amber-500/15 text-amber-300", "bg-rose-500/15 text-rose-300", "bg-teal-500/15 text-teal-300", "bg-info/15 text-info"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return arr[Math.abs(h) % arr.length];
}
