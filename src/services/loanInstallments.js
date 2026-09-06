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

export async function disburseLoan(accountId, destinationAccountId, date, installments, description) {

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
