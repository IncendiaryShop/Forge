import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

const fromRow = (r) => ({
  id: r.id,
  transactionId: r.transaction_id,
  accountId: r.account_id,
  principal: Number(r.principal),
  interestRate: Number(r.interest_rate),
  tenureMonths: r.tenure_months,
  emiAmount: Number(r.emi_amount),
  totalInterest: Number(r.total_interest),
  totalPayable: Number(r.total_payable),
  startDate: r.start_date,
  status: r.status,
  createdAt: r.created_at,
});
export { fromRow as mapEmiPlanRow };

// Local mirror of emiInstallments.js's row mapper, kept private to this file.
// create_emi_plan() returns the freshly generated installment schedule inline
// alongside the plan — parsing it here (rather than importing across the two
// EMI service modules) avoids a circular import between emiPlans.js and
// emiInstallments.js, since the latter needs the reverse mapper too.
const fromInstallmentRow = (r) => ({
  id: r.id,
  emiPlanId: r.emi_plan_id,
  installmentNumber: r.installment_number,
  dueDate: r.due_date,
  amount: Number(r.amount),
  status: r.status,
  paidDate: r.paid_date,
  paymentTransactionId: r.payment_transaction_id,
  settledViaPreclosure: !!r.settled_via_preclosure,
});

export async function listEmiPlans() {
  const { data, error } = await call(
    supabase.from("emi_plans").select("*").order("created_at", { ascending: true }),
    "Couldn't load EMI plans."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

// Converts a transaction to EMI via the create_emi_plan() RPC — atomic:
// validates ownership/type/account, inserts the plan, and generates its full
// installment schedule in one database transaction. See supabase/schema.sql
// for the full validation this performs server-side (never trust only the
// client-side checks in EmiConvertForm). The EMI math itself (emiAmount /
// totalInterest / totalPayable) is computed client-side (utils/emi.js) and
// passed straight through, so the created plan always matches exactly what
// the user saw in the conversion modal.
export async function createEmiPlan(userId, plan) {
  const { data, error } = await call(
    supabase.rpc("create_emi_plan", {
      p_transaction_id: plan.transactionId,
      p_account_id: plan.accountId,
      p_principal: Number(plan.principal),
      p_interest_rate: Number(plan.interestRate) || 0,
      p_tenure_months: Number(plan.tenureMonths),
      p_emi_amount: Number(plan.emiAmount),
      p_total_interest: Number(plan.totalInterest),
      p_total_payable: Number(plan.totalPayable),
      p_start_date: plan.startDate,
    }),
    "Couldn't convert this transaction to EMI."
  );
  if (error) return { data: null, error };
  return {
    data: {
      plan: fromRow(data.plan),
      installments: (data.installments || []).map(fromInstallmentRow),
    },
    error: null,
  };
}

// Deleting a plan cascades to its installments at the database level
// (emi_installments.emi_plan_id -> emi_plans(id) ON DELETE CASCADE) — never
// leaves an orphaned installment row. Any installment that had already been
// paid keeps its payment Transfer transaction untouched (that FK points the
// other way, installments -> transactions, and is ON DELETE SET NULL on the
// transactions side) — deleting a plan never deletes real transaction
// history, only the plan/schedule bookkeeping on top of it.
export async function deleteEmiPlan(id) {
  const { error } = await call(
    supabase.from("emi_plans").delete().eq("id", id),
    "Couldn't delete the EMI plan."
  );
  return { error };
}

// Pre-closes an Active plan via the preclose_emi_plan() RPC — atomic:
// settles every remaining (not-yet-Paid) installment in one Transfer from
// `sourceAccountId` to the plan's Credit Card, marks those installments Paid
// (flagged settledViaPreclosure so the normal per-installment Undo refuses to
// touch them — they share one settlement transaction), and moves the plan to
// 'Preclosed' — a terminal status distinct from 'Completed' (reached by
// paying every installment individually) and from 'Cancelled' (an abandoned
// EMI). Already-Paid installments are left untouched. See supabase/schema.sql
// for the full server-side validation — never trust only the client-side
// checks in EmiSchedule.jsx.
export async function precloseEmiPlan(planId, sourceAccountId, date, description) {
  const { data, error } = await call(
    supabase.rpc("preclose_emi_plan", {
      p_plan_id: planId,
      p_source_account_id: sourceAccountId,
      p_date: date,
      p_description: description || null,
    }),
    "Couldn't pre-close this EMI plan."
  );
  if (error) return { data: null, error };
  return {
    data: {
      transaction: mapTransactionRow(data.transaction),
      plan: fromRow(data.plan),
      installments: (data.installments || []).map(fromInstallmentRow),
    },
    error: null,
  };
}
