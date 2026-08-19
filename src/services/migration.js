import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { STORAGE_KEY } from "../utils/constants";
import { normalizeData } from "../utils/normalizeData";

// ============================================================================
// One-time migration of a user's existing browser localStorage data into
// their new Supabase account. See section 11 of the migration brief for the
// exact required behavior — summarized:
//
//   - never touch local data if the user already has ANY cloud data for an
//     ambiguous (not-yet-decided) reason — surface a choice instead
//   - never run twice — idempotency is tracked via profiles.migrated_at,
//     which is only set after a migration attempt fully succeeds
//   - never invent relationships — old short random ids (see utils/helpers
//     uid()) are remapped to the new Supabase UUIDs via lookup tables built
//     during insertion, in FK-dependency order
// ============================================================================

const oldIdMaps = () => ({ accounts: new Map(), bills: new Map(), invoices: new Map(), transactions: new Map() });

export function readLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeData(JSON.parse(raw));
  } catch {
    return null; // corrupt local data — nothing safely migratable
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

// Returns one of:
//   "already-migrated"  — profiles.migrated_at is set, nothing to do, safe to load from cloud
//   "no-local-data"      — nothing in localStorage worth migrating
//   "ready-to-migrate"    — no cloud rows exist yet for this user, safe to auto-migrate
//   "ambiguous"           — cloud already has rows but migrated_at was never set
//                            (e.g. a previous attempt partially failed, or data
//                            was created some other way) — do NOT auto-migrate
export async function getMigrationState(userId) {
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

// Performs the migration. Only call this after getMigrationState() returned
// "ready-to-migrate" — the caller (AuthGate/App) is responsible for that
// gating and for getting explicit confirmation from the user on "ambiguous".
export async function migrateLocalDataToCloud(userId, local) {
  const ids = oldIdMaps();

  // 1) accounts
  if (local.accounts.length) {
    const rows = local.accounts.map((a) => ({
      user_id: userId, name: a.name, type: a.type, provider: a.provider || null, opening: Number(a.opening) || 0,
      credit_limit: a.type === "Credit Card" && a.creditLimit != null && a.creditLimit !== "" ? Number(a.creditLimit) : null,
    }));
    const { data, error } = await call(supabase.from("accounts").insert(rows).select(), "Migration failed while creating accounts.");
    if (error) return { success: false, error };
    data.forEach((row, i) => ids.accounts.set(local.accounts[i].id, row.id));
  }

  // 2) bills (without paid_transaction_id — transactions don't exist yet)
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

  // 3) invoices (without transaction_id yet)
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

  // 4) transactions — every account_id must resolve, otherwise skip that
  // transaction rather than inserting one with a broken/null required FK
  // (account_id is NOT NULL). Skipped rows are reported back so the caller
  // can tell the user, rather than silently dropping data.
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

  // 5) back-fill bills.paid_transaction_id now that transactions exist
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

  // 6) back-fill invoices.transaction_id
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

  // 7) budgets
  const budgetEntries = Object.entries(local.budgets);
  if (budgetEntries.length) {
    const rows = budgetEntries.map(([category, amount]) => ({ user_id: userId, category, amount: Number(amount) }));
    const { error } = await call(supabase.from("budgets").insert(rows), "Migration failed while creating budgets.");
    if (error) return { success: false, error };
  }

  // 8) goals
  if (local.goals.length) {
    const rows = local.goals.map((g) => ({
      user_id: userId, name: g.name, target: Number(g.target), current: Number(g.current) || 0, deadline: g.deadline || null,
    }));
    const { error } = await call(supabase.from("goals").insert(rows), "Migration failed while creating goals.");
    if (error) return { success: false, error };
  }

  // 9) verify basic relationship integrity before declaring success — every
  // paid bill/invoice that had a transaction locally must have one now.
  const brokenBillLinks = local.bills.filter((b) => b.paidTransactionId && !billPatches.find((p) => p.id === ids.bills.get(b.id)));
  const brokenInvoiceLinks = local.invoices.filter((inv) => inv.transactionId && !invoicePatches.find((p) => p.id === ids.invoices.get(inv.id)));
  if (brokenBillLinks.length || brokenInvoiceLinks.length || skippedTransactions.length) {
    return {
      success: false,
      error: { message: "Migration completed with unresolved relationships and was not marked complete. Please contact support before using the app." },
      partial: { skippedTransactions, brokenBillLinks, brokenInvoiceLinks },
    };
  }

  // 10) only now mark the migration complete — this is the idempotency gate
  // that getMigrationState() checks on every future login.
  const { error: markError } = await call(
    supabase.from("profiles").upsert({ id: userId, migrated_at: new Date().toISOString() }),
    "Data was migrated, but the completion flag couldn't be saved. Migration may run again next time — this will not duplicate already-migrated data because the app will still find your cloud data."
  );
  if (markError) return { success: false, error: markError };

  return { success: true, error: null };
}

// Used when local data exists but wasn't migrated (no-local-data / already
// migrated / user explicitly chose "keep cloud data" on an ambiguous state) —
// clears the local copy so stale data can't resurface or confuse a future
// browser session. Never called before a successful migration or an explicit
// user choice.
export function clearLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort — not clearing local data isn't itself a correctness bug,
    // since the cloud copy (source of truth from here on) is unaffected.
  }
}

// Used from the "ambiguous" screen when the user explicitly chooses to keep
// their existing cloud data over the local copy — marks migration complete
// without importing anything, so this choice is never asked again.
export async function markMigratedWithoutImporting(userId) {
  const { error } = await call(
    supabase.from("profiles").upsert({ id: userId, migrated_at: new Date().toISOString() }),
    "Couldn't save your choice. Please try again."
  );
  return { error };
}
