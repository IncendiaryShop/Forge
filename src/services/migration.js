import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { STORAGE_KEY } from "../utils/constants";
import { normalizeData } from "../utils/normalizeData";

const oldIdMaps = () => ({ accounts: new Map(), bills: new Map(), invoices: new Map(), transactions: new Map() });

export function readLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeData(JSON.parse(raw));
  } catch {
    return null;
  }
}

function localDataIsEmpty(local) {
  if (!local) return true;
  return (
    local.accounts.length === 0 &&
    local.transactions.length === 0 &&
    local.bills.length === 0 &&
    local.invoices.length === 0 &&
    local.goals.length === 0 &&
    Object.keys(local.budgets).length === 0
  );
}

export async function getMigrationState(userId) {

  const { error: ensureProfileError } = await call(
    supabase.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true }),
    "Couldn't initialize your profile."
  );
  if (ensureProfileError) return { state: "error", error: ensureProfileError };

  const { data: profile, error: profileError } = await call(
    supabase.from("profiles").select("migrated_at").eq("id", userId).single(),
    "Couldn't check migration status."
  );
  if (profileError) return { state: "error", error: profileError };
  if (profile?.migrated_at) return { state: "already-migrated" };

  const local = readLocalData();
  if (localDataIsEmpty(local)) return { state: "no-local-data" };

  const { count, error: countError } = await call(
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    "Couldn't check your cloud data."
  );
  if (countError) return { state: "error", error: countError };

  if ((count ?? 0) > 0) return { state: "ambiguous", local };
  return { state: "ready-to-migrate", local };
}

export async function migrateLocalDataToCloud(userId, local) {
  const ids = oldIdMaps();

  if (local.accounts.length) {
    const rows = local.accounts.map((a) => ({
      user_id: userId, name: a.name, type: a.type, provider: a.provider || null, opening: Number(a.opening) || 0,
      credit_limit: a.type === "Credit Card" && a.creditLimit != null && a.creditLimit !== "" ? Number(a.creditLimit) : null,
    }));
    const { data, error } = await call(supabase.from("accounts").insert(rows).select(), "Migration failed while creating accounts.");
    if (error) return { success: false, error };
    data.forEach((row, i) => ids.accounts.set(local.accounts[i].id, row.id));
  }

  if (local.bills.length) {
    const rows = local.bills.map((b) => ({
      user_id: userId, name: b.name, category: b.category, amount: Number(b.amount), due_day: Number(b.dueDay),
      recurring: b.recurring !== false, provider: b.provider || null,
      account_id: b.account ? ids.accounts.get(b.account) || null : null,
      paid_cycle: b.paidCycle || null,
    }));
    const { data, error } = await call(supabase.from("bills").insert(rows).select(), "Migration failed while creating bills.");
    if (error) return { success: false, error };
    data.forEach((row, i) => ids.bills.set(local.bills[i].id, row.id));
  }

  if (local.invoices.length) {
    const rows = local.invoices.map((inv) => ({
      user_id: userId, invoice_number: inv.invoiceNumber, client: inv.client, invoice_date: inv.invoiceDate,
      amount: Number(inv.amount), status: inv.status === "Paid" ? "Paid" : "Unpaid",
      payment_date: inv.paymentDate || null,
      payment_account_id: inv.paymentAccountId ? ids.accounts.get(inv.paymentAccountId) || null : null,
    }));
    const { data, error } = await call(supabase.from("invoices").insert(rows).select(), "Migration failed while creating invoices.");
    if (error) return { success: false, error };
    data.forEach((row, i) => ids.invoices.set(local.invoices[i].id, row.id));
  }

  const skippedTransactions = [];
  if (local.transactions.length) {
    const rows = [];
    const sourceRows = [];
    local.transactions.forEach((t) => {
      const accountId = ids.accounts.get(t.account);
      if (!accountId) { skippedTransactions.push(t); return; }
      rows.push({
        user_id: userId, date: t.date, type: t.type, category: t.category, description: t.description || null,
        account_id: accountId,
        transfer_account_id: t.type === "Transfer" && t.transferAccount ? ids.accounts.get(t.transferAccount) || null : null,
        amount: Number(t.amount),
        bill_id: t.billId ? ids.bills.get(t.billId) || null : null,
        invoice_id: t.invoiceId ? ids.invoices.get(t.invoiceId) || null : null,
      });
      sourceRows.push(t);
    });
    if (rows.length) {
      const { data, error } = await call(supabase.from("transactions").insert(rows).select(), "Migration failed while creating transactions.");
      if (error) return { success: false, error };
      data.forEach((row, i) => ids.transactions.set(sourceRows[i].id, row.id));
    }
  }

  const billPatches = local.bills
    .filter((b) => b.paidTransactionId && ids.transactions.get(b.paidTransactionId) && ids.bills.get(b.id))
    .map((b) => ({ id: ids.bills.get(b.id), paid_transaction_id: ids.transactions.get(b.paidTransactionId) }));
  for (const patch of billPatches) {
    const { error } = await call(
      supabase.from("bills").update({ paid_transaction_id: patch.paid_transaction_id }).eq("id", patch.id),
      "Migration failed while linking a paid bill to its transaction."
    );
    if (error) return { success: false, error };
  }

  const invoicePatches = local.invoices
    .filter((inv) => inv.transactionId && ids.transactions.get(inv.transactionId) && ids.invoices.get(inv.id))
    .map((inv) => ({ id: ids.invoices.get(inv.id), transaction_id: ids.transactions.get(inv.transactionId) }));
  for (const patch of invoicePatches) {
    const { error } = await call(
      supabase.from("invoices").update({ transaction_id: patch.transaction_id }).eq("id", patch.id),
      "Migration failed while linking a paid invoice to its transaction."
    );
    if (error) return { success: false, error };
  }

  const budgetEntries = Object.entries(local.budgets);
  if (budgetEntries.length) {
    const rows = budgetEntries.map(([category, amount]) => ({ user_id: userId, category, amount: Number(amount) }));
    const { error } = await call(supabase.from("budgets").insert(rows), "Migration failed while creating budgets.");
    if (error) return { success: false, error };
  }

  if (local.goals.length) {
    const rows = local.goals.map((g) => ({
      user_id: userId, name: g.name, target: Number(g.target), current: Number(g.current) || 0, deadline: g.deadline || null,
    }));
    const { error } = await call(supabase.from("goals").insert(rows), "Migration failed while creating goals.");
    if (error) return { success: false, error };
  }

  const brokenBillLinks = local.bills.filter((b) => b.paidTransactionId && !billPatches.find((p) => p.id === ids.bills.get(b.id)));
  const brokenInvoiceLinks = local.invoices.filter((inv) => inv.transactionId && !invoicePatches.find((p) => p.id === ids.invoices.get(inv.id)));
  if (brokenBillLinks.length || brokenInvoiceLinks.length || skippedTransactions.length) {
    return {
      success: false,
      error: { message: "Migration completed with unresolved relationships and was not marked complete. Please contact support before using the app." },
      partial: { skippedTransactions, brokenBillLinks, brokenInvoiceLinks },
    };
  }

  const { error: markError } = await call(
    supabase.from("profiles").upsert({ id: userId, migrated_at: new Date().toISOString() }),
    "Data was migrated, but the completion flag couldn't be saved. Migration may run again next time — this will not duplicate already-migrated data because the app will still find your cloud data."
  );
  if (markError) return { success: false, error: markError };

  return { success: true, error: null };
}

export function clearLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    void err;
  }
}

export async function markMigratedWithoutImporting(userId) {
  const { error } = await call(
    supabase.from("profiles").upsert({ id: userId, migrated_at: new Date().toISOString() }),
    "Couldn't save your choice. Please try again."
  );
  return { error };
}
