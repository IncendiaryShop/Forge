import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

const fromRow = (r) => ({
  id: r.id,
  accountId: r.account_id,
  installmentNumber: r.installment_number,
  dueDate: r.due_date,
  emiAmount: Number(r.emi_amount),
  principalComponent: Number(r.principal_component),
  interestComponent: Number(r.interest_component),
  status: r.status,
  paidDate: r.paid_date,
  principalTransactionId: r.principal_transaction_id,
  interestTransactionId: r.interest_transaction_id,
});
export { fromRow as mapLoanInstallmentRow };

export async function listLoanInstallments() {
  const { data, error } = await call(
    supabase.from("loan_installments").select("*").order("due_date", { ascending: true }),
    "Couldn't load loan installments."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

// Disburses a Loan account via the disburse_loan() RPC — atomic: records the
// disbursement as a Transfer from the loan account to the receiving Bank/Cash
// account (never Income), then bulk-inserts the pre-computed amortization
// schedule (utils/loanAmortization.js). Rejects if the loan has already been
// disbursed (a loan can only be disbursed once).
export async function disburseLoan(accountId, destinationAccountId, date, installments, description) {
  // installments[].dueDate arrives as a local-midnight Date object (from
  // clampedDueDate) — local Y-M-D formatting, not toISOString(), which
  // converts to UTC first and can shift the calendar day backward for
  // positive UTC offsets.
  const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data, error } = await call(
    supabase.rpc("disburse_loan", {
      p_account_id: accountId,
      p_destination_account_id: destinationAccountId,
      p_date: date,
      p_installments: installments.map((i) => ({
        installment_number: i.installmentNumber,
        due_date: toLocalISO(i.dueDate),
        emi_amount: i.emiAmount,
        principal_component: i.principalComponent,
        interest_component: i.interestComponent,
      })),
      p_description: description || null,
    }),
    "Couldn't disburse this loan."
  );
  if (error) return { data: null, error };
  return {
    data: {
      transaction: mapTransactionRow(data.transaction),
      installments: (data.installments || []).map(fromRow),
    },
    error: null,
  };
}

// Pays one loan installment via the pay_loan_installment() RPC — atomic:
// splits the EMI into an Expense (interest component, if any) and a Transfer
// (principal component, into the loan account), marks the installment Paid,
// and completes the loan once every installment is paid. See
// supabase/schema.sql for the full server-side validation.
export async function payLoanInstallment(installment, sourceAccountId, date, description) {
  const { data, error } = await call(
    supabase.rpc("pay_loan_installment", {
      p_installment_id: installment.id,
      p_source_account_id: sourceAccountId,
      p_date: date,
      p_description: description || null,
    }),
    "Couldn't record the loan payment."
  );
  if (error) return { data: null, error };
  return {
    data: {
      installment: fromRow(data.installment),
      principalTransaction: mapTransactionRow(data.principalTransaction),
      interestTransaction: data.interestTransaction ? mapTransactionRow(data.interestTransaction) : null,
      loanStatus: data.loanStatus,
    },
    error: null,
  };
}

// Pre-closes an Active loan via the preclose_loan() RPC — atomic: settles the
// ENTIRE current Outstanding Principal in one Transfer from sourceAccountId
// to the loan account, marks every remaining Upcoming installment
// 'Preclosed' (Paid installments untouched), and moves the loan to
// 'Preclosed'. See supabase/schema.sql for the full server-side validation —
// the settlement amount is always computed server-side, never trusted from
// the client.
export async function precloseLoan(accountId, sourceAccountId, date, description) {
  const { data, error } = await call(
    supabase.rpc("preclose_loan", {
      p_account_id: accountId,
      p_source_account_id: sourceAccountId,
      p_date: date,
      p_description: description || null,
    }),
    "Couldn't pre-close this loan."
  );
  if (error) return { data: null, error };
  return {
    data: {
      transaction: mapTransactionRow(data.transaction),
      installments: (data.installments || []).map(fromRow),
      loanStatus: data.loanStatus,
    },
    error: null,
  };
}
