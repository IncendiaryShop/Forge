export function ProgressBar({ pct, colorClass = "bg-accent", trackClass }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`w-full h-2 rounded-full overflow-hidden ${trackClass || "bg-elevated"}`}>
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
