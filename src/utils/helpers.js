

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function fmt(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : "";
}

export function hashColorClasses(str) {
  const arr = ["bg-accent/12 text-accent", "bg-white/10 text-subtext", "bg-success/15 text-success", "bg-white/5 text-subtext", "bg-warning/15 text-warning", "bg-danger/15 text-danger", "bg-white/[0.06] text-subtext", "bg-white/[0.08] text-subtext"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return arr[Math.abs(h) % arr.length];
}
