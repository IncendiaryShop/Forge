import { supabase } from "../lib/supabase";
import { call } from "./errors";

// DB (snake_case) <-> app model (camelCase, matches the pre-Supabase shape
// exactly so AppContext/pages/forms don't need to change).
const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  provider: r.provider || "",
  opening: Number(r.opening),
  // Absent for non-Credit Card accounts, and for any pre-existing Credit
  // Card account created before this field existed — null rather than 0 so
  // "no limit set yet" stays distinguishable from "limit is zero".
  creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
  // Credit Card billing cycle (Phase 7) — day-of-month settings, nullable
  // for the same reason as creditLimit above.
  statementDate: r.statement_date != null ? Number(r.statement_date) : null,
  paymentDueDate: r.payment_due_date != null ? Number(r.payment_due_date) : null,
  // Loan accounts only (Phase 9) — `opening` above doubles as the Original
  // Principal. Nullable for every non-Loan account.
  loanInterestRate: r.loan_interest_rate != null ? Number(r.loan_interest_rate) : null,
  loanTenureMonths: r.loan_tenure_months != null ? Number(r.loan_tenure_months) : null,
  loanEmiAmount: r.loan_emi_amount != null ? Number(r.loan_emi_amount) : null,
  loanStartDate: r.loan_start_date || null,
  loanStatus: r.loan_status || null,
});

const toRow = (a) => ({
  name: a.name,
  type: a.type,
  provider: a.provider || null,
  opening: Number(a.opening) || 0,
  credit_limit: a.type === "Credit Card" && a.creditLimit != null && a.creditLimit !== "" ? Number(a.creditLimit) : null,
  statement_date: a.type === "Credit Card" && a.statementDate != null && a.statementDate !== "" ? Number(a.statementDate) : null,
  payment_due_date: a.type === "Credit Card" && a.paymentDueDate != null && a.paymentDueDate !== "" ? Number(a.paymentDueDate) : null,
  loan_interest_rate: a.type === "Loan" && a.loanInterestRate != null && a.loanInterestRate !== "" ? Number(a.loanInterestRate) : null,
  loan_tenure_months: a.type === "Loan" && a.loanTenureMonths != null && a.loanTenureMonths !== "" ? Number(a.loanTenureMonths) : null,
  loan_emi_amount: a.type === "Loan" && a.loanEmiAmount != null && a.loanEmiAmount !== "" ? Number(a.loanEmiAmount) : null,
  loan_start_date: a.type === "Loan" && a.loanStartDate ? a.loanStartDate : null,
  loan_status: a.type === "Loan" ? (a.loanStatus || "Active") : null,
});

export async function listAccounts() {
  const { data, error } = await call(
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    "Couldn't load accounts."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createAccount(userId, account) {
  const { data, error } = await call(
    supabase.from("accounts").insert({ ...toRow(account), user_id: userId }).select().single(),
    "Couldn't create the account."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateAccount(id, patch) {
  const { data, error } = await call(
    supabase.from("accounts").update(toRow({ ...patch })).eq("id", id).select().single(),
    "Couldn't save the account."
  );
  return { data: data ? fromRow(data) : null, error };
}

// Deleting an account that's referenced by any transaction is rejected by the
// database (transactions.account_id / transfer_account_id use ON DELETE
// RESTRICT) — this mirrors the existing client-side guard in AccountsPage,
// now enforced at the DB level too. Postgres error code 23503 maps to a
// friendly "linked to other data" message via services/errors.js.
export async function deleteAccount(id) {
  const { error } = await call(
    supabase.from("accounts").delete().eq("id", id),
    "This account has transactions linked to it and can't be deleted."
  );
  return { error };
}
