import { supabase } from "../lib/supabase";
import { call } from "./errors";
import { fromRow } from "./invoices";

function toRow(model) {
  return {
    invoice_number: model.invoiceNumber,
    client: model.billTo?.name || "",
    invoice_date: model.invoiceDate,
    amount: model.total,
    kind: "generated",
    due_date: model.dueDate || null,
    payment_terms: model.paymentTerms || null,
    currency: model.currency || "INR",
    seller: model.seller || null,
    bill_to: model.billTo || null,
    items: model.items || [],
    discount: Number(model.discount) || 0,
    tax_rate: Number(model.taxRate) || 0,
    notes: model.notes || null,
    payment_info: model.paymentInfo || null,
    pdf_path: model.pdfPath || null,
    pdf_generated_at: model.pdfPath ? new Date().toISOString() : null,
    needs_regeneration: false,
  };
}

export async function createGeneratedInvoice(userId, model) {
  const { data, error } = await call(
    supabase.from("invoices").insert({
      ...toRow(model),
      user_id: userId,
      status: "Unpaid",
      payment_date: null,
      payment_account_id: null,
      transaction_id: null,
    }).select().single(),
    "Couldn't create the invoice."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateGeneratedInvoice(id, model, regenerated) {
  const patch = toRow(model);
  if (!regenerated) {
    delete patch.pdf_path;
    delete patch.pdf_generated_at;
    patch.needs_regeneration = true;
  }
  const { data, error } = await call(
    supabase.from("invoices").update(patch).eq("id", id).select().single(),
    "Couldn't save the invoice."
  );
  return { data: data ? fromRow(data) : null, error };
}
