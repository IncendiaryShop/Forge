import { clampedDueDate } from "./billCycle";

/* ----------------------------- Loan amortization ----------------------------- */
/* Standard reducing-balance amortization: each installment's interest is
   computed on the OUTSTANDING balance as of that installment (not a flat
   rate on the original principal), same method real lenders use. Given:

     Principal, annual Interest Rate (%), Tenure (months), EMI amount,
     Start Date

   returns an array of { installmentNumber, dueDate, emiAmount,
   principalComponent, interestComponent }, running the balance down to
   exactly 0 by construction — the LAST installment's principal component
   absorbs whatever's left (rather than the formula's own rounding), so the
   schedule always sums to exactly `principal` regardless of how the EMI was
   arrived at. This mirrors the same "last one absorbs the remainder" rule
   Credit Card EMI already uses (create_emi_plan, supabase/schema.sql).

   Due dates use clampedDueDate (utils/billCycle.js) for month-boundary
   safety, rolling forward from the start date's own day-of-month each
   installment — the exact same helper Credit Card billing cycles (Phase 7)
   and bills already use, so there's only one place that math lives. */

export function generateLoanSchedule(principal, annualRatePercent, tenureMonths, emiAmount, startDate) {
  const P = Number(principal) || 0;
  const n = Math.max(0, Math.trunc(Number(tenureMonths) || 0));
  const annualRate = Number(annualRatePercent) || 0;
  const emi = Number(emiAmount) || 0;
  if (P <= 0 || n <= 0 || emi <= 0 || !startDate) return [];

  const r = annualRate / 12 / 100;
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);

  const schedule = [];
  let balance = P;

  for (let i = 1; i <= n; i++) {
    const interestComponent = Math.round(balance * r);
    let principalComponent;

    if (i === n) {
      // Final installment: whatever principal remains, exactly — this is
      // what guarantees the schedule sums to `principal` to the rupee,
      // regardless of accumulated rounding in the earlier installments.
      principalComponent = Math.max(balance, 0);
    } else {
      principalComponent = Math.max(emi - interestComponent, 0);
      if (principalComponent > balance) principalComponent = balance;
    }

    balance = Math.max(balance - principalComponent, 0);

    const dueDate = clampedDueDate(startYear, startMonth - 1 + i, startDay);
    schedule.push({
      installmentNumber: i,
      dueDate,
      emiAmount: i === n ? principalComponent + interestComponent : emi,
      principalComponent,
      interestComponent,
    });
  }

  return schedule;
}
