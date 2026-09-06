import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { mapTransactionRow } from "./transactions";

export const fromRow = (r) => ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  client: r.client,
  invoiceDate: r.invoice_date,
  amount: Number(r.amount),
  status: r.status,
  paymentDate: r.payment_date,
  paymentAccountId: r.payment_account_id,
  transactionId: r.transaction_id,

  kind: r.kind || "manual",
  dueDate: r.due_date ?? null,
  paymentTerms: r.payment_terms ?? null,
  currency: r.currency || "INR",
  seller: r.seller ?? null,
  billTo: r.bill_to ?? null,
  items: r.items ?? [],
  discount: Number(r.discount) || 0,
  taxRate: Number(r.tax_rate) || 0,
  notes: r.notes ?? null,
  paymentInfo: r.payment_info ?? null,
  pdfPath: r.pdf_path ?? null,
  pdfGeneratedAt: r.pdf_generated_at ?? null,
  needsRegeneration: !!r.needs_regeneration,
});

const toRow = (i) => ({
  invoice_number: i.invoiceNumber,
  client: i.client,
  invoice_date: i.invoiceDate,
  amount: Number(i.amount),
});

export async function listInvoices() {
  const { data, error } = await call(
    supabase.from("invoices").select("*").order("created_at", { ascending: true }),
    "Couldn't load invoices."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createInvoice(userId, invoice) {
  const { data, error } = await call(
    supabase.from("invoices").insert({
      ...toRow(invoice), user_id: userId, status: "Unpaid",
      payment_date: null, payment_account_id: null, transaction_id: null,
    }).select().single(),
    "Couldn't create the invoice."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateInvoice(id, patch) {
  const { data, error } = await call(
    supabase.from("invoices").update(toRow(patch)).eq("id", id).select().single(),
    "Couldn't save the invoice."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function deleteInvoice(id) {
  const { error } = await call(
    supabase.from("invoices").delete().eq("id", id),
    "Couldn't delete the invoice."
  );
  return { error };
}

export async function payInvoice(userId, invoice, accountId, date) {
  const { data, error } = await call(
    supabase.rpc("pay_invoice", { p_invoice_id: invoice.id, p_account_id: accountId, p_date: date }),
    "Couldn't record the invoice payment."
  );
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: { invoice: fromRow(row.invoice_row), transaction: mapTransactionRow(row.transaction_row) }, error: null };
}
