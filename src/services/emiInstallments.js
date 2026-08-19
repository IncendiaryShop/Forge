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
  // true only for installments settled as part of a preclose_emi_plan()
  // batch (which share ONE payment_transaction_id across multiple
  // installments) — see the guard in unpayEmiInstallment() below.
  settledViaPreclosure: !!r.settled_via_preclosure,
});
export { fromRow as mapEmiInstallmentRow };

// Local mirror of emiPlans.js's row mapper — see the note there for why this
// isn't a cross-module import. Only needed here to parse the `plan` object
// pay_emi_installment() / the unpay flow below return when an installment's
// payment flips (or un-flips) its plan's Completed status.
const fromPlanRow = (r) => ({
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

export async function listEmiInstallments() {
  const { data, error } = await call(
    supabase.from("emi_installments").select("*").order("due_date", { ascending: true }),
    "Couldn't load EMI installments."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

// Pays one installment via the pay_emi_installment() RPC — atomic: records
// the payment as a Transfer from `sourceAccountId` into the EMI plan's
// Credit Card account (exactly the existing Credit Card payment model, see
// App.jsx's accountOutstanding()), marks the installment Paid, and flips the
// plan to 'Completed' if that was the last unpaid installment. No separate
// "EMI payment" balance logic exists anywhere — reducing outstanding is a
// side effect of the Transfer, same as any manual card payment.
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

// Undoes a payment: removes the linked Transfer transaction (which also
// reverses its effect on the card's outstanding, same as unpayBill()'s
// pattern for bills) and resets the installment to Upcoming. No atomicity
// requirement here for the same reason noted on unpayBill() in
// services/bills.js — this is a rare, user-initiated correction, not a
// concurrent hot path. If the plan had been marked Completed by this
// installment's payment, it's reverted back to Active.
//
// Installments settled by preclose_emi_plan() (settledViaPreclosure) share
// ONE payment_transaction_id across potentially many rows — undoing any one
// of them the normal way would delete that shared transaction and corrupt
// every sibling installment still pointing at it. Rejected before any
// Supabase call is made; pre-closure settlements can only be reversed by
// their own explicit flow (there isn't one — see EmiSchedule.jsx), never by
// this ordinary single-installment Undo.
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
