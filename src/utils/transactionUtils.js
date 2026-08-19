export function sortTransactionsDesc(transactions) {
  return [...transactions].sort((a, b) => {
    const dateCmp = String(b.date).localeCompare(String(a.date));
    if (dateCmp !== 0) return dateCmp;
    const aTie = a.createdAt || a.date;
    const bTie = b.createdAt || b.date;
    const createdCmp = String(bTie).localeCompare(String(aTie));
    if (createdCmp !== 0) return createdCmp;
    // Final stable tie-breaker — date and created_at can both be identical
    // (e.g. rows from the same bulk insert/migration batch), so without
    // this the JS engine's own (technically stable, but fetch-order-
    // dependent) sort would decide, which isn't deterministic once realtime
    // refetches can hand back rows in a different order.
    return String(b.id).localeCompare(String(a.id));
  });
}

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function relativeDate(dateStr) {
  if (!dateStr) return dateStr;
  const d = parseLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return dateStr;
}