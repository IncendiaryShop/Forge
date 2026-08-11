import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  amount: Number(r.amount),
  dueDay: r.due_day,
  recurring: r.recurring,
  provider: r.provider || "custom",
  account: r.account_id || "",
  paidCycle: r.paid_cycle,
  paidTransactionId: r.paid_transaction_id,
});

const toRow = (b) => ({
  name: b.name,
  category: b.category,
  amount: Number(b.amount),
  due_day: Number(b.dueDay),
  recurring: b.recurring !== false,
  provider: b.provider || null,
  account_id: b.account || null,
});

export async function listBills() {
  const { data, error } = await call(
    supabase.from("bills").select("*").order("created_at", { ascending: true }),
    "Couldn't load bills."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createBill(userId, bill) {
  const { data, error } = await call(
    supabase.from("bills").insert({ ...toRow(bill), user_id: userId, paid_cycle: null, paid_transaction_id: null }).select().single(),
    "Couldn't create the bill."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateBill(id, patch) {
  const { data, error } = await call(
    supabase.from("bills").update(toRow(patch)).eq("id", id).select().single(),
    "Couldn't save the bill."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function deleteBill(id) {
  const { error } = await call(
    supabase.from("bills").delete().eq("id", id),
    "Couldn't delete the bill."
  );
  return { error };
}

// Marks a bill paid via the pay_bill() Postgres RPC (see supabase/schema.sql)
// so the whole operation — ownership checks, active-cycle determination,
// duplicate-payment check, transaction insert, and bill update — happens
// atomically in one database transaction. If anything inside it fails, the
// RPC raises and Postgres rolls back every statement in the function, so
// there's no partial state to recover from client-side. `cycle` is no longer
// passed in: the database determines/validates the active billing cycle
// itself from `bill.due_day` and the payment date, so a stale client-side
// cycle can never be used to fool the duplicate-payment check.
export async function payBill(userId, bill, accountId, date) {
  const { data, error } = await call(
    supabase.rpc("pay_bill", { p_bill_id: bill.id, p_account_id: accountId, p_date: date }),
    "Couldn't record the bill payment."
  );
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: { bill: fromRow(row.bill_row), transaction: mapTransactionRow(row.transaction_row) }, error: null };
}

// Unpay has no atomicity requirement in this task's scope (only *paying* a
// bill/invoice needed to become atomic) — kept as the existing two-step
// client-side flow: delete the linked transaction (a no-op if a previous
// partial failure already removed it), then clear the cycle.
export async function unpayBill(bill) {
  if (bill.paidTransactionId) {
    const { error: delError } = await call(
      supabase.from("transactions").delete().eq("id", bill.paidTransactionId),
      "Couldn't remove the linked transaction."
    );
    if (delError) return { data: null, error: delError };
  }
  const { data, error } = await call(
    supabase.from("bills").update({ paid_cycle: null, paid_transaction_id: null }).eq("id", bill.id).select().single(),
    "Couldn't update the bill."
  );
  return { data: data ? fromRow(data) : null, error };
}
