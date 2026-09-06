import { supabase } from "../lib/supabase";
import { call } from "./errors";

const BUCKET = "invoice-files";

function safeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadInvoicePdf(userId, invoiceNumber, bytes) {
  const path = `${userId}/invoices/${safeName(invoiceNumber)}-${Date.now()}.pdf`;
  const { error } = await call(
    supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true }),
    "Couldn't store the generated PDF."
  );
  if (error) return { data: null, error };
  return { data: { path }, error: null };
}

export async function removeInvoiceFile(path) {
  if (!path) return { error: null };
  const { error } = await call(supabase.storage.from(BUCKET).remove([path]), "Couldn't clean up the stored file.");
  return { error };
}

export async function getSignedInvoiceUrl(path, expiresIn = 300, downloadName) {
  const { data, error } = await call(
    supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn, downloadName ? { download: downloadName } : undefined),
    "Couldn't open this file."
  );
  return { data: data ? data.signedUrl : null, error };
}
