

export function calculateEmi(principal, annualRatePercent, tenureMonths) {
  const P = Number(principal) || 0;
  const n = Math.max(0, Math.trunc(Number(tenureMonths) || 0));
  const annualRate = Number(annualRatePercent) || 0;

  if (P <= 0 || n <= 0) {
    return { emiAmount: 0, totalPayable: 0, totalInterest: 0 };
  }

  const r = annualRate / 12 / 100;
  let rawEmi;
  if (r === 0) {
    rawEmi = P / n;
  } else {
    const factor = Math.pow(1 + r, n);
    rawEmi = (P * r * factor) / (factor - 1);
  }

  const emiAmount = Math.round(rawEmi);
  const totalPayable = emiAmount * n;
  const totalInterest = Math.max(0, totalPayable - P);

  return { emiAmount, totalPayable, totalInterest };
}
