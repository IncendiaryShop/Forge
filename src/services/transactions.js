import { supabase } from "../lib/supabase";
import { call } from "./errors";

const fromRow = (r) => ({
  id: r.id,
  date: r.date,
  type: r.type,
  category: r.category,
  description: r.description || "",
  account: r.account_id,
  transferAccount: r.transfer_account_id || "",
  amount: Number(r.amount),
  billId: r.bill_id || undefined,
  invoiceId: r.invoice_id || undefined,
  createdAt: r.created_at,
});
export { fromRow as mapTransactionRow };

const toRow = (t) => ({
  date: t.date,
  type: t.type,
  category: t.category,
  description: t.description || null,
  account_id: t.account,
  transfer_account_id: t.type === "Transfer" ? t.transferAccount || null : null,
  amount: Number(t.amount),
  bill_id: t.billId || null,
  invoice_id: t.invoiceId || null,
});

export async function listTransactions() {
  const { data, error } = await call(
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    "Couldn't load transactions."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createTransaction(userId, txn) {
  const { data, error } = await call(
    supabase.from("transactions").insert({ ...toRow(txn), user_id: userId }).select().single(),
    "Couldn't save the transaction."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateTransaction(id, patch) {
  const { data, error } = await call(
    supabase.from("transactions").update(toRow(patch)).eq("id", id).select().single(),
    "Couldn't save the transaction."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function deleteTransaction(id) {
  const { error } = await call(
    supabase.from("transactions").delete().eq("id", id),
    "Couldn't delete the transaction."
  );
  return { error };
}
