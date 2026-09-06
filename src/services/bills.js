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

export async function payBill(userId, bill, accountId, date) {
  const { data, error } = await call(
    supabase.rpc("pay_bill", { p_bill_id: bill.id, p_account_id: accountId, p_date: date }),
    "Couldn't record the bill payment."
  );
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: { bill: fromRow(row.bill_row), transaction: mapTransactionRow(row.transaction_row) }, error: null };
}

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
