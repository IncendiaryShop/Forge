function cycleKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function clampedDueDate(year, month, dueDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const actualDay = Math.min(Number(dueDay), lastDay);
  return new Date(year, month, actualDay);
}

export function computeBillStatus(bill, today) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const oneDay = 1000 * 60 * 60 * 24;

  const thisMonthDue = clampedDueDate(year, month, bill.dueDay);
  const diffThisMonth = Math.round((thisMonthDue - today) / oneDay);

  if (diffThisMonth >= 0) {
    return { daysOut: diffThisMonth, overdue: false, cycle: cycleKey(thisMonthDue) };
  }

  const nextMonthDue = clampedDueDate(year, month + 1, bill.dueDay);
  const diffNextMonth = Math.round((nextMonthDue - today) / oneDay);

  if (diffNextMonth <= 5) {
    return { daysOut: diffNextMonth, overdue: false, cycle: cycleKey(nextMonthDue) };
  }

  return { daysOut: diffThisMonth, overdue: true, cycle: cycleKey(thisMonthDue) };
}

export function getActiveBillingCycle(bill, today) {
  return computeBillStatus(bill, today).cycle;
}

export function statusLabel(entry) {
  if (entry.overdue) {
    const n = Math.abs(entry.daysOut);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (entry.daysOut === 0) return "Due Today";
  if (entry.daysOut === 1) return "Due Tomorrow";
  return `Due in ${entry.daysOut} days`;
}

export function badgeFor(entry) {
  if (entry.overdue) return { label: "OVERDUE", cls: "bg-red-500/15 text-red-400 border border-red-500/20" };
  if (entry.daysOut === 0) return { label: "TODAY", cls: "bg-red-500/15 text-red-400 border border-red-500/20" };
  if (entry.daysOut === 1) return { label: "TOMORROW", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/20" };
  return { label: `${entry.daysOut} DAYS`, cls: "bg-amber-500/15 text-amber-400 border border-amber-500/20" };
}