import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, PrimaryButton } from "../components";

export function InvoiceForm({ onDone, existing }) {
  const { addInvoice, updateInvoice } = useApp();
  const [form, setForm] = useState(existing
    ? { invoiceNumber: existing.invoiceNumber, client: existing.client, invoiceDate: existing.invoiceDate, amount: existing.amount }
    : { invoiceNumber: "", client: "", invoiceDate: "", amount: "" }
  );
  const [error, setError] = useState("");
  const isPaid = existing?.status === "Paid";

  const submit = (e) => {
    e.preventDefault();
    if (!form.invoiceNumber.trim() || !form.client.trim() || !form.invoiceDate) {
      setError("All fields are required.");
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      setError("Amount must be greater than 0.");
      return;
    }
    const payload = {
      invoiceNumber: form.invoiceNumber.trim(),
      client: form.client.trim(),
      invoiceDate: form.invoiceDate,
      amount,
    };
    if (existing) updateInvoice(existing.id, payload);
    else addInvoice(payload);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Invoice Number">
        <TextInput value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="e.g. INV-2026-015" required />
      </Field>
      <Field label="Client / Name">
        <TextInput value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="e.g. Acme Corp" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice Date">
          <TextInput type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required disabled={isPaid} />
        </Field>
        <Field label="Amount (₹)">
          <TextInput type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required disabled={isPaid} />
        </Field>
      </div>
      {error && <p className="type-secondary text-red-500">{error}</p>}
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Invoice"}</PrimaryButton>
    </form>
  );
}