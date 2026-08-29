/* --------------------------------- EMI math -------------------------------- */
/* Standard reducing-balance EMI formula. `annualRatePercent` is the yearly
   rate as a plain percentage (e.g. 14.5 for 14.5% p.a.) — converted to a
   monthly rate internally. A 0% rate is treated as a straight-line split
   (principal / tenure) rather than dividing by zero.

   Amounts are rounded to the nearest rupee by design — this is the EMI
   repayment model itself (real lenders quote EMIs in whole rupees), not a
   display-only rounding — so what's shown in the conversion modal is exactly
   what gets stored. totalPayable is emiAmount * tenureMonths; any sub-rupee
   rounding remainder is absorbed into the final installment by the backend
   (create_emi_plan(), supabase/schema.sql) so the schedule always sums to
   exactly totalPayable. */

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

/* ----------------------------- Manual EMI totals ----------------------------- */
/* Used by the "Add EMI Plan" manual-registration flow (AddEmiPlanForm) for an
   EMI that already exists on the user's card. Unlike calculateEmi() above,
   the EMI amount here is entered directly by the user, not derived from
   principal/rate/tenure — so it's never rounded to a whole rupee; it's
   ordinary decimal money input (see fmt() in utils/helpers.js), not the EMI
   repayment model's own rounding.

   totalPayable is simply emiAmount * remainingTenureMonths — the last
   installment absorbs any remainder server-side (create_manual_emi_plan(),
   supabase/schema.sql), same pattern as calculateEmi()'s totalPayable.
   totalInterest is whatever's left over the outstanding principal, floored
   at 0 — informational only, never fed back into the schedule math.

   coversPrincipal is false when the entered EMI × tenure doesn't even add
   up to the outstanding principal — a likely data-entry mismatch worth
   surfacing, but never a reason to block submission (interest can
   legitimately make the totals differ either way). */
export function computeManualEmiTotals(outstandingPrincipal, emiAmount, remainingTenureMonths) {
  const P = Number(outstandingPrincipal) || 0;
  const emi = Number(emiAmount) || 0;
  const n = Math.max(0, Math.trunc(Number(remainingTenureMonths) || 0));

  if (emi <= 0 || n <= 0) {
    return { totalPayable: 0, totalInterest: 0, coversPrincipal: true };
  }

  const totalPayable = emi * n;
  const totalInterest = Math.max(0, totalPayable - P);
  const coversPrincipal = totalPayable >= P;

  return { totalPayable, totalInterest, coversPrincipal };
}