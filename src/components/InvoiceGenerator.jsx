import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import { Field } from "./Field";
import { TextInput } from "./TextInput";
import { DatePicker } from "./DatePicker";
import { Select } from "./Select";
import { PrimaryButton } from "./PrimaryButton";
import { GhostButton } from "./GhostButton";
import { AppIcon } from "./AppIcon";
import { IconBtn } from "./IconBtn";
import { ManageClientsModal } from "./ManageClientsModal";
import { todayISO } from "../utils/helpers";
import {
  computeTotals,
  formatAmount,
  nextInvoiceNumber,
  isInvoiceNumberTaken,
  emptyParty,
  emptyPaymentInfo,
  emptyItem,
} from "../utils/invoiceCalc";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

function partyFromExisting(existing, key) {
  return existing?.[key] ? { ...emptyParty(), ...existing[key] } : emptyParty();
}

export function InvoiceGenerator({ existing, onClose }) {
  const { data, theme, generateInvoice, saveGeneratedInvoice, addClient, updateClient } = useApp();

  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoiceNumber || nextInvoiceNumber(data.invoices));
  const [invoiceDate, setInvoiceDate] = useState(existing?.invoiceDate || todayISO());
  const [dueDate, setDueDate] = useState(existing?.dueDate || "");
  const [paymentTerms, setPaymentTerms] = useState(existing?.paymentTerms || "");
  const [currency, setCurrency] = useState(existing?.currency || "INR");
  const [seller, setSeller] = useState(() => partyFromExisting(existing, "seller"));
  const [billTo, setBillTo] = useState(() => partyFromExisting(existing, "billTo"));
  const [loadedClientId, setLoadedClientId] = useState(null);
  const [clientStatus, setClientStatus] = useState("");
  const [manageClientsOpen, setManageClientsOpen] = useState(false);
  const [items, setItems] = useState(existing?.items?.length ? existing.items.map((i) => ({ ...i })) : [emptyItem()]);
  const [discount, setDiscount] = useState(existing?.discount || 0);
  const [taxRate, setTaxRate] = useState(existing?.taxRate || 0);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [paymentInfo, setPaymentInfo] = useState(existing?.paymentInfo ? { ...emptyPaymentInfo(), ...existing.paymentInfo } : emptyPaymentInfo());

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const totals = useMemo(() => computeTotals(items, discount, taxRate), [items, discount, taxRate]);

  const model = { invoiceNumber, invoiceDate, dueDate, paymentTerms, currency, seller, billTo, items, discount, taxRate, notes, paymentInfo };

  const setPartyField = (which, field, value) => {
    const setter = which === "seller" ? setSeller : setBillTo;
    setter((p) => ({ ...p, [field]: value }));
  };

  const loadSavedClient = (id) => {
    if (!id) { setLoadedClientId(null); return; }
    const c = data.clients.find((x) => x.id === id);
    if (!c) return;
    setBillTo({ ...emptyParty(), ...c });
    setLoadedClientId(id);
    setClientStatus("");
  };

  const saveAsNewClient = async () => {
    if (!billTo.name.trim()) { setClientStatus("Add a client name first."); return; }
    setClientStatus("Saving...");
    const r = await addClient({ ...billTo });
    if (r?.error) { setClientStatus(r.error.message || "Couldn't save this client."); return; }
    setLoadedClientId(r.data.id);
    setClientStatus("Saved.");
  };

  const updateSavedClient = async () => {
    if (!loadedClientId) return;
    setClientStatus("Saving...");
    const r = await updateClient(loadedClientId, { ...billTo });
    setClientStatus(r?.error ? (r.error.message || "Couldn't update this client.") : "Updated.");
  };

  const updateItem = (idx, patch) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => setItems((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr));
  const addItem = () => setItems((arr) => [...arr, emptyItem()]);

  const validate = () => {
    if (!invoiceNumber.trim()) return "Invoice number is required.";
    if (isInvoiceNumberTaken(data.invoices, invoiceNumber.trim(), existing?.id)) return "This invoice number is already in use.";
    if (!invoiceDate) return "Invoice date is required.";
    if (dueDate && dueDate < invoiceDate) return "Due date can't be before the invoice date.";
    if (!billTo.name.trim()) return "Client / company name is required.";
    if (items.length === 0) return "Add at least one line item.";
    for (const it of items) {
      if (!it.description.trim()) return "Every line item needs a description.";
      if (!(Number(it.qty) > 0)) return "Quantity must be greater than 0.";
      if (Number(it.rate) < 0) return "Rate can't be negative.";
    }
    return "";
  };

  const submit = async (regenerate) => {
    const v = validate();
    if (v) { setError(v); return; }
    setError("");
    setSubmitting(true);
    try {
      const payload = { ...model, invoiceNumber: invoiceNumber.trim(), total: totals.total };
      const result = existing
        ? await saveGeneratedInvoice(existing.id, payload, regenerate)
        : await generateInvoice(payload);
      if (result?.error) {
        setError(result.error.message || "Something went wrong. Please try again.");
        return;
      }
      setSuccess({ invoiceNumber: payload.invoiceNumber, blobUrl: result.blobUrl || null });
    } catch (e) {
      setError(e?.message || "Couldn't generate the invoice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const partyFields = (which, party) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label={which === "seller" ? "Business / Person Name" : "Client / Company Name"}>
          <TextInput value={party.name} onChange={(e) => setPartyField(which, "name", e.target.value)} />
        </Field>
      </div>
      <Field label="Contact Person"><TextInput value={party.contact} onChange={(e) => setPartyField(which, "contact", e.target.value)} /></Field>
      <Field label="Email"><TextInput type="email" value={party.email} onChange={(e) => setPartyField(which, "email", e.target.value)} /></Field>
      <div className="col-span-2">
        <Field label="Address"><TextInput value={party.address} onChange={(e) => setPartyField(which, "address", e.target.value)} /></Field>
      </div>
      <Field label="City"><TextInput value={party.city} onChange={(e) => setPartyField(which, "city", e.target.value)} /></Field>
      <Field label="State"><TextInput value={party.state} onChange={(e) => setPartyField(which, "state", e.target.value)} /></Field>
      <Field label="Postal Code"><TextInput value={party.postalCode} onChange={(e) => setPartyField(which, "postalCode", e.target.value)} /></Field>
      <Field label="Country"><TextInput value={party.country} onChange={(e) => setPartyField(which, "country", e.target.value)} /></Field>
      <Field label="Phone"><TextInput value={party.phone} onChange={(e) => setPartyField(which, "phone", e.target.value)} /></Field>
      <Field label="Tax / GST"><TextInput value={party.tax} onChange={(e) => setPartyField(which, "tax", e.target.value)} /></Field>
    </div>
  );

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex flex-col ${theme.modalOverlay}`} data-no-rubber-band>
      <div className={`flex items-center justify-between px-5 sm:px-8 py-4 border-b ${theme.border} ${theme.card}`}>
        <div>
          <h2 className="type-section-title">{existing ? "Edit Generated Invoice" : "Generate Invoice"}</h2>
          <p className={`type-secondary mt-0.5 ${theme.subtext}`}>Create a professional invoice and generate a PDF.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className={`forge-button p-2 rounded-[10px] ${theme.hover}`}>
          <AppIcon name="ui.close" size={18} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto forge-scroll-contain ${theme.content}`}>
        {success ? (
          <div className="max-w-md mx-auto py-16 px-5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5">
              <AppIcon name="ui.checkCircle" size={26} className="text-emerald-400" />
            </div>
            <p className="type-body font-medium">Invoice generated successfully</p>
            <p className={`type-secondary mt-1 ${theme.subtext}`}>{success.invoiceNumber}.pdf</p>
            <div className="flex items-center justify-center gap-3 mt-6">
              {success.blobUrl && (
                <GhostButton onClick={() => window.open(success.blobUrl, "_blank", "noopener")}>
                  <AppIcon name="ui.view" size={15} /> View PDF
                </GhostButton>
              )}
              {success.blobUrl && (
                <a href={success.blobUrl} download={`${success.invoiceNumber}.pdf`} className="forge-button type-button inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-accent text-bg !font-medium hover:bg-accent-hover transition-all duration-150">
                  <AppIcon name="ui.download" size={15} /> Download PDF
                </a>
              )}
            </div>
            <GhostButton className="mt-8 mx-auto justify-center" onClick={onClose}>Done</GhostButton>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-0 lg:h-full">

            <div className="p-5 sm:p-8 space-y-6 lg:overflow-y-auto forge-scroll-contain">
              <section className="space-y-3">
                <h3 className="type-card-label">Invoice Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice Number"><TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
                  <Field label="Currency">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                  <Field label="Invoice Date"><DatePicker value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Field>
                  <Field label="Due Date"><DatePicker value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
                  <div className="col-span-2">
                    <Field label="Payment Terms"><TextInput value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 15" /></Field>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="type-card-label">From</h3>
                {partyFields("seller", seller)}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="type-card-label">Bill To</h3>
                  <button type="button" onClick={() => setManageClientsOpen(true)} className={`type-small-label ${theme.subtext} hover:text-text underline underline-offset-2`}>
                    Manage saved clients
                  </button>
                </div>
                {data.clients?.length > 0 && (
                  <Field label="Load saved client">
                    <Select value={loadedClientId || ""} onChange={(e) => loadSavedClient(e.target.value)}>
                      <option value="">— New client —</option>
                      {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                )}
                {partyFields("billTo", billTo)}
                <div className="flex items-center gap-2 flex-wrap">
                  <GhostButton onClick={saveAsNewClient}><AppIcon name="ui.add" size={13} /> Save as New Client</GhostButton>
                  {loadedClientId && (
                    <GhostButton onClick={updateSavedClient}><AppIcon name="ui.edit" size={13} /> Update Saved Client</GhostButton>
                  )}
                  {clientStatus && <span className={`type-small-label ${theme.subtext}`}>{clientStatus}</span>}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="type-card-label">Line Items</h3>
                  <GhostButton onClick={addItem}><AppIcon name="ui.add" size={13} /> Add Item</GhostButton>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className={`p-3 rounded-[12px] border ${theme.border} grid grid-cols-12 gap-2 items-end`}>
                      <div className="col-span-12 sm:col-span-5">
                        <Field label="Description"><TextInput value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} /></Field>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Field label="Qty"><TextInput type="number" min="0" step="1" value={it.qty} onChange={(e) => updateItem(idx, { qty: e.target.value })} /></Field>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Field label="Rate"><TextInput type="number" min="0" step="0.01" value={it.rate} onChange={(e) => updateItem(idx, { rate: e.target.value })} /></Field>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Field label="Amount"><div className="forge-control px-3.5 py-2.5 rounded-[14px]">{formatAmount((Number(it.qty) || 0) * (Number(it.rate) || 0), currency)}</div></Field>
                      </div>
                      <div className="col-span-1 flex items-center justify-end pb-0.5">
                        <IconBtn icon="ui.delete" danger title="Remove" onClick={() => removeItem(idx)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field label={`Discount (${currency})`}><TextInput type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
                  <Field label="Tax Rate (%)"><TextInput type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></Field>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="type-card-label">Notes</h3>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${theme.input}`}
                  placeholder="Thank you for your business." />
              </section>

              <section className="space-y-3">
                <h3 className="type-card-label">Payment Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank Name"><TextInput value={paymentInfo.bankName} onChange={(e) => setPaymentInfo((p) => ({ ...p, bankName: e.target.value }))} /></Field>
                  <Field label="Account Name"><TextInput value={paymentInfo.accountName} onChange={(e) => setPaymentInfo((p) => ({ ...p, accountName: e.target.value }))} /></Field>
                  <Field label="Account Number"><TextInput value={paymentInfo.accountNumber} onChange={(e) => setPaymentInfo((p) => ({ ...p, accountNumber: e.target.value }))} /></Field>
                  <Field label="IFSC"><TextInput value={paymentInfo.ifsc} onChange={(e) => setPaymentInfo((p) => ({ ...p, ifsc: e.target.value }))} /></Field>
                  <Field label="UPI ID"><TextInput value={paymentInfo.upiId} onChange={(e) => setPaymentInfo((p) => ({ ...p, upiId: e.target.value }))} /></Field>
                  <div className="col-span-2">
                    <Field label="Payment Instructions"><TextInput value={paymentInfo.instructions} onChange={(e) => setPaymentInfo((p) => ({ ...p, instructions: e.target.value }))} /></Field>
                  </div>
                </div>
                <p className={`type-small-label ${theme.subtext}`}>Leave blank to omit this section from the PDF.</p>
              </section>
            </div>

            <div className={`p-5 sm:p-8 border-t lg:border-t-0 lg:border-l ${theme.border} lg:overflow-y-auto`}>
              <div className="bg-white text-[#171717] rounded-[10px] shadow-xl shadow-black/30 p-6 sm:p-8 mx-auto max-w-[560px]" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-black tracking-tight">INVOICE</h1>
                    <p className="text-gray-400 text-[11px] mt-1">Thank you for your business.</p>
                  </div>
                  <div className="text-right text-[11px] leading-tight space-y-1.5">
                    <div><p className="text-gray-400">Invoice No.</p><p className="font-semibold text-[13px]">{invoiceNumber || "—"}</p></div>
                    <div><p className="text-gray-400">Issue Date</p><p className="font-semibold text-[13px]">{invoiceDate || "—"}</p></div>
                    {dueDate && <div><p className="text-gray-400">Due Date</p><p className="font-semibold text-[13px]">{dueDate}</p></div>}
                    {paymentTerms && <div><p className="text-gray-400">Payment Terms</p><p className="font-semibold text-[13px]">{paymentTerms}</p></div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-7 text-[11px]">
                  <div>
                    <p className="text-gray-400 font-medium mb-1.5">From</p>
                    <p className="font-semibold text-[13px]">{seller.name || "—"}</p>
                    <p className="text-gray-500">{seller.address}</p>
                    <p className="text-gray-500">{[seller.city, seller.state, seller.postalCode].filter(Boolean).join(", ")}</p>
                    <p className="text-gray-500">{seller.country}</p>
                    <p className="text-gray-500 mt-1">{seller.email}</p>
                    <p className="text-gray-500">{seller.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium mb-1.5">Bill To</p>
                    <p className="font-semibold text-[13px]">{billTo.name || "—"}</p>
                    <p className="text-gray-500">{billTo.contact}</p>
                    <p className="text-gray-500">{billTo.address}</p>
                    <p className="text-gray-500">{[billTo.city, billTo.state, billTo.postalCode].filter(Boolean).join(", ")}</p>
                    <p className="text-gray-500">{billTo.country}</p>
                    <p className="text-gray-500 mt-1">{billTo.email}</p>
                    <p className="text-gray-500">{billTo.phone}</p>
                  </div>
                </div>

                <table className="w-full mt-7 text-[11px] border-separate border-spacing-0">
                  <thead>
                    <tr style={{ background: "#f2f2f7" }}>
                      <th className="text-left font-semibold text-gray-500 px-3 py-2.5 rounded-l-[6px]">#</th>
                      <th className="text-left font-semibold text-gray-500 px-3 py-2.5">Description</th>
                      <th className="text-right font-semibold text-gray-500 px-3 py-2.5">Qty</th>
                      <th className="text-right font-semibold text-gray-500 px-3 py-2.5">Rate</th>
                      <th className="text-right font-semibold text-gray-500 px-3 py-2.5 rounded-r-[6px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">{it.description || "—"}</td>
                        <td className="px-3 py-2 text-right">{it.qty || 0}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(it.rate, currency)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatAmount((Number(it.qty) || 0) * (Number(it.rate) || 0), currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mt-5">
                  <div className="w-52 rounded-[8px] overflow-hidden" style={{ background: "#f6f6fa" }}>
                    <div className="px-4 py-3 space-y-1.5 text-[11px]">
                      <div className="flex justify-between font-semibold"><span>Subtotal</span><span>{formatAmount(totals.subtotal, currency)}</span></div>
                      {totals.discountAmt > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>− {formatAmount(totals.discountAmt, currency)}</span></div>}
                      <div className="flex justify-between text-gray-500"><span>Tax ({Number(taxRate)}%)</span><span>{formatAmount(totals.taxAmt, currency)}</span></div>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 font-bold text-[13px]" style={{ background: "#e9e4fb", color: "#5b3fb0" }}>
                      <span>TOTAL</span><span>{formatAmount(totals.total, currency)}</span>
                    </div>
                  </div>
                </div>

                {notes && (
                  <div className="mt-7 text-[11px]">
                    <p className="font-semibold mb-2">Notes</p>
                    <div className="rounded-[8px] px-4 py-3 text-gray-600 whitespace-pre-wrap" style={{ background: "#f6f6fa" }}>{notes}</div>
                  </div>
                )}

                {Object.values(paymentInfo).some((v) => v.trim?.()) && (
                  <div className="mt-7 text-[11px]">
                    <p className="font-semibold mb-2">Payment Information</p>
                    <div className="rounded-[8px] flex" style={{ background: "#f6f6fa" }}>
                      <div className="flex-1 px-4 py-3 space-y-1.5">
                        {paymentInfo.bankName && <div className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">Bank Name</span><span>{paymentInfo.bankName}</span></div>}
                        {paymentInfo.accountName && <div className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">Account Name</span><span>{paymentInfo.accountName}</span></div>}
                        {paymentInfo.accountNumber && <div className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">Account Number</span><span>{paymentInfo.accountNumber}</span></div>}
                        {paymentInfo.ifsc && <div className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">IFSC Code</span><span>{paymentInfo.ifsc}</span></div>}
                        {!paymentInfo.upiId && paymentInfo.instructions && <div className="flex gap-3"><span className="text-gray-400 w-28 shrink-0">Instructions</span><span>{paymentInfo.instructions}</span></div>}
                      </div>
                      {paymentInfo.upiId && (
                        <div className="w-40 shrink-0 border-l border-gray-200 px-4 py-3">
                          <p className="font-semibold mb-1">UPI Payments</p>
                          <p className="text-gray-500">You can also pay via UPI using:</p>
                          <p className="mt-1">{paymentInfo.upiId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-3 border-t border-gray-100 flex justify-between text-[9px] text-gray-400">
                  <span>Invoice generated on {invoiceDate}</span>
                  {seller.email && <span>For any queries, contact {seller.email}</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!success && (
        <div className={`flex items-center justify-between px-5 sm:px-8 py-4 border-t ${theme.border} ${theme.card}`}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          {error && <p className="type-secondary text-red-500 flex-1 text-center px-4">{error}</p>}
          <div className="flex items-center gap-2">
            {existing && (
              <GhostButton onClick={() => submit(false)} disabled={submitting}>Save Changes</GhostButton>
            )}
            <PrimaryButton onClick={() => submit(true)} disabled={submitting}>
              {submitting ? "Generating invoice..." : existing ? "Save & Regenerate PDF" : "Generate PDF"}
            </PrimaryButton>
          </div>
        </div>
      )}

      {manageClientsOpen && (
        <ManageClientsModal
          onClose={() => setManageClientsOpen(false)}
          onLoad={(id) => { loadSavedClient(id); setManageClientsOpen(false); }}
        />
      )}
    </div>,
    document.body
  );
}
