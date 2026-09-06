import { clampedDueDate } from "./billCycle";

function cycleKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentBillingCycle(account, today) {
  if (!account.statementDate) return null;

  const year = today.getFullYear();
  const month = today.getMonth();

  const thisMonthStatement = clampedDueDate(year, month, account.statementDate);
  const isCurrentCycle = thisMonthStatement <= today;

  const statementDate = isCurrentCycle
    ? thisMonthStatement
    : clampedDueDate(year, month - 1, account.statementDate);

  let dueDate = null;
  if (account.paymentDueDate) {
    const sameMonthDue = clampedDueDate(statementDate.getFullYear(), statementDate.getMonth(), account.paymentDueDate);
    dueDate = sameMonthDue >= statementDate
      ? sameMonthDue
      : clampedDueDate(statementDate.getFullYear(), statementDate.getMonth() + 1, account.paymentDueDate);
  }

  return { statementDate, dueDate, cycleKey: cycleKey(statementDate) };
}
