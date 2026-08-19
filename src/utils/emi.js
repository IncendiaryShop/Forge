/* --------------------------------- EMI math -------------------------------- */
/* Standard reducing-balance EMI formula. `annualRatePercent` is the yearly
   rate as a plain percentage (e.g. 14.5 for 14.5% p.a.) — converted to a
   monthly rate internally. A 0% rate is treated as a straight-line split
   (principal / tenure) rather than dividing by zero.

   Amounts are rounded to the nearest rupee (Forge never displays paise —
   see fmt() in utils/helpers.js) so what's shown in the conversion modal is
   exactly what gets stored. totalPayable is emiAmount * tenureMonths; any
   sub-rupee rounding remainder is absorbed into the final installment by the
   backend (create_emi_plan(), supabase/schema.sql) so the schedule always
   sums to exactly totalPayable. */

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
