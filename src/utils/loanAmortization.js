import { clampedDueDate } from "./billCycle";

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
