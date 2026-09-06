import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

const fromRow = (r) => ({
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
export { fromRow as mapEmiInstallmentRow };

const fromPlanRow = (r) => ({
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

export async function listEmiInstallments() {
  const { data, error } = await call(
    supabase.from("emi_installments").select("*").order("due_date", { ascending: true }),
    "Couldn't load EMI installments."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function payEmiInstallment(installment, sourceAccountId, date, description) {
  const { data, error } = await call(
    supabase.rpc("pay_emi_installment", {
      p_installment_id: installment.id,
      p_source_account_id: sourceAccountId,
      p_date: date,
      p_description: description || null,
    }),
    "Couldn't record the EMI payment."
  );
  if (error) return { data: null, error };
  return {
    data: {
      installment: fromRow(data.installment),
      transaction: mapTransactionRow(data.transaction),
      plan: data.plan ? fromPlanRow(data.plan) : null,
    },
    error: null,
  };
}

export async function unpayEmiInstallment(installment) {
  if (installment.settledViaPreclosure) {
    return { data: null, error: { message: "This installment was settled as part of an EMI pre-closure and can't be undone individually." } };
  }

  if (installment.paymentTransactionId) {
    const { error: delError } = await call(
      supabase.from("transactions").delete().eq("id", installment.paymentTransactionId),
      "Couldn't remove the linked transaction."
    );
    if (delError) return { data: null, error: delError };
  }

  const { data, error } = await call(
    supabase.from("emi_installments").update({ status: "Upcoming", paid_date: null, payment_transaction_id: null }).eq("id", installment.id).select().single(),
    "Couldn't update the installment."
  );
  if (error) return { data: null, error };

  const { data: planRows, error: planError } = await call(
    supabase.from("emi_plans").update({ status: "Active" }).eq("id", data.emi_plan_id).eq("status", "Completed").select(),
    "Couldn't update the EMI plan."
  );
  if (planError) return { data: null, error: planError };

  const planRow = Array.isArray(planRows) ? planRows[0] : null;
  return { data: { installment: fromRow(data), plan: planRow ? fromPlanRow(planRow) : null }, error: null };
}
