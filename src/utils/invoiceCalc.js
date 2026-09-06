

export const CURRENCY_SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code || "";
}

export function formatAmount(n, currency) {
  const v = Number(n) || 0;
  return `${currencySymbol(currency)}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function lineAmount(item) {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0);
}

export function computeTotals(items, discount, taxRate) {
  const subtotal = (items || []).reduce((s, it) => s + lineAmount(it), 0);
  const discountAmt = Math.max(0, Number(discount) || 0);
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmt = taxable * ((Number(taxRate) || 0) / 100);
  const total = taxable + taxAmt;
  return { subtotal, discountAmt, taxable, taxAmt, total };
}

export function nextInvoiceNumber(existingInvoices) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let max = 0;
  (existingInvoices || []).forEach((inv) => {
    if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
      const n = parseInt(inv.invoiceNumber.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function isInvoiceNumberTaken(existingInvoices, number, excludeId) {
  return (existingInvoices || []).some((inv) => inv.invoiceNumber === number && inv.id !== excludeId);
}

export const emptyParty = () => ({ name: "", contact: "", address: "", city: "", state: "", postalCode: "", country: "", email: "", phone: "", tax: "" });
export const emptyPaymentInfo = () => ({ bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "", instructions: "" });
export const emptyItem = () => ({ description: "", qty: 1, rate: 0 });

export function isPartyBlank(party) {
  if (!party) return true;
  return Object.values(party).every((v) => !String(v || "").trim());
}
