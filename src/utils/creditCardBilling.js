import { clampedDueDate } from "./billCycle";

/* -------------------------- Credit Card billing cycle -------------------------- */
/* A Credit Card's Statement Date and Payment Due Date are day-of-month
   settings (1-31), same convention as a recurring bill's dueDay. Reuses
   clampedDueDate (utils/billCycle.js) for the actual month-boundary math —
   "the 31st" on a 30-day month clamps to that month's last day, exactly the
   same rule bills already use, so there's only one place that logic lives.

   Statement Balance is NOT derived here — once a statement is generated it's
   a frozen snapshot stored in credit_card_statements (see
   services/creditCardStatements.js), independent of the live, ever-changing
   Outstanding figure (accountOutstanding() in App.jsx). This module only
   answers "what are the current cycle's statement/due dates", which is what
   a new statement would be generated for if the user generates one today. */

function cycleKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Returns the most recent statement date that is on or before `today`, along
// with the payment due date that follows it (which may fall in the next
// calendar month, e.g. a statement on the 28th with a due date on the 10th).
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
