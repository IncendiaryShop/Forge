import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

const fromRow = (r) => ({
  id: r.id,
  transactionId: r.transaction_id,
  accountId: r.account_id,

  name: r.name,

  source: r.source,
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

export async function deleteEmiPlan(id) {
  const { error } = await call(
    supabase.from("emi_plans").delete().eq("id", id),
    "Couldn't delete the EMI plan."
  );
  return { error };
}

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
