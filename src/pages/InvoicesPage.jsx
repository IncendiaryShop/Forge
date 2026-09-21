import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Card, Badge, PrimaryButton, IconBtn, Modal, EmptyState, Field, Select, GhostButton, AppIcon, AccountLogo, DatePicker, InvoiceGenerator, InvoiceDetailModal } from "../components";
import { InvoiceForm } from "../forms/InvoiceForm";
import { getSignedInvoiceUrl } from "../services/invoiceStorage";
import { fmt, todayISO } from "../utils/helpers";

const STATUS_STYLES = {
  UNPAID: "bg-amber-500/15 text-amber-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
};

function getInvoiceInfo(invoice, today) {
  if (invoice.status === "Paid") {
    return { group: 2, label: "PAID", sub: invoice.paymentDate ? `Paid ${invoice.paymentDate}` : "" };
  }
  if (invoice.invoiceDate < today) {
    return { group: 0, label: "UNPAID", sub: "" };
  }
  if (invoice.invoiceDate === today) {
    return { group: 1, label: "UNPAID", sub: "Due Today" };
  }
  return { group: 1, label: "UNPAID", sub: "" };
}

export function InvoicesPage() {
  const { data, theme, isDemoMode, deleteInvoice, markInvoicePaid } = useApp();
  const [modal, setModal] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [generatorTarget, setGeneratorTarget] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAccount, setPayAccount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const today = todayISO();

  const accountName = (id) => data.accounts.find(a => a.id === id)?.name || "—";

  const sorted = useMemo(() => {
  return data.invoices
    .map((inv, index) => ({
      inv,
      index,
      info: getInvoiceInfo(inv, today),
    }))
    .filter(({ inv }) => {
      if (statusFilter === "PAID") {
        return inv.status === "Paid";
      }

      if (statusFilter === "UNPAID") {
        return inv.status !== "Paid";
      }

      return true;
    })
    .sort((a, b) => {
      if (a.info.group !== b.info.group) {
        return a.info.group - b.info.group;
      }

      const dateCmp = b.inv.invoiceDate.localeCompare(
        a.inv.invoiceDate
      );

      if (dateCmp !== 0) {
        return dateCmp;
      }

      return b.index - a.index;
    });
}, [data.invoices, today, statusFilter]);

  const openPayModal = (invoice) => {
    setPayAccount(data.accounts[0]?.id || "");
    setPayDate(today);
    setPayModal(invoice);
  };

  const confirmPay = (e) => {
    e.preventDefault();
    if (!payAccount || !payDate) return;
    markInvoicePaid(payModal.id, payAccount, payDate);
    setPayModal(null);
  };

  const openEdit = (invoice) => {
    if (invoice.kind === "generated") setGeneratorTarget(invoice);
    else setModal(invoice);
  };

  const viewInvoicePdf = async (invoice) => {
    if (isDemoMode || !invoice.pdfPath) return;
    const { data: url } = await getSignedInvoiceUrl(invoice.pdfPath, 300);
    if (url) window.open(url, "_blank", "noopener");
  };

  const downloadInvoice = async (invoice) => {
    if (isDemoMode || !invoice.pdfPath) return;
    const { data: url } = await getSignedInvoiceUrl(invoice.pdfPath, 300, `${invoice.invoiceNumber}.pdf`);
    if (url) window.open(url, "_blank", "noopener");
  };

  const requestDelete = (invoice) => {
    if (invoice.status === "Paid" && invoice.transactionId) {
      setDeleteTarget(invoice);
    } else {
      deleteInvoice(invoice.id);
    }
  };

  const confirmDelete = () => {
    deleteInvoice(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end gap-2">
  <PrimaryButton onClick={() => setModal("new")}>
    Add Invoice
  </PrimaryButton>
  <GhostButton onClick={() => setGeneratorTarget("new")}>
    Generate Invoice
  </GhostButton>
</div>

      <Card className="overflow-hidden">

  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">

    <div>
      <h3 className="type-section-title">
        Total Invoices
      </h3>

      <p className={`type-small-label mt-1 ${theme.subtext}`}>
        {sorted.length} {sorted.length === 1 ? "invoice" : "invoices"}
      </p>
    </div>

    <Select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className={`forge-control px-3 py-2 rounded-[10px] border text-[13px] outline-none w-full sm:w-auto ${theme.input}`}
    >
      <option value="ALL">All Invoices</option>
      <option value="UNPAID">Unpaid</option>
      <option value="PAID">Paid</option>
    </Select>

  </div>

  {sorted.length === 0 ? (
          <EmptyState icon={(p) => <AppIcon name="invoiceStates.invoice" {...p} />} title="No invoices yet" subtitle="Add your first invoice to start tracking payments" />
        ) : (
          <>

          <div className="md:hidden divide-y divide-white/[0.06]">
            {sorted.map(({ inv, info }) => (
              <div key={inv.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button type="button" onClick={() => setDetailTarget(inv)} className="type-body font-medium truncate text-left hover:underline">{inv.invoiceNumber}</button>
                    <p className={`type-small-label mt-0.5 truncate ${theme.subtext}`}>{inv.client}</p>
                  </div>
                  <p className="type-body font-semibold shrink-0">{fmt(inv.amount)}</p>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={STATUS_STYLES[info.label]}>{info.label}</Badge>
                    <p className={`type-small-label truncate ${theme.subtext}`}>
                      {inv.invoiceDate}
                      {info.sub ? ` · ${info.sub}` : ""}
                    </p>
                  </div>
                </div>

                {inv.status === "Paid" && (
                  <p className={`type-small-label mt-1.5 ${theme.subtext}`}>
                    Paid {inv.paymentDate || "—"} into {inv.paymentAccountId ? accountName(inv.paymentAccountId) : "—"}
                  </p>
                )}

                <div className="flex items-center justify-end gap-1 mt-2.5">
                  {inv.status !== "Paid" && (
                    <IconBtn icon="invoiceStates.payment" onClick={() => openPayModal(inv)} title="Mark Paid" />
                  )}
                  <IconBtn icon="ui.edit" onClick={() => openEdit(inv)} title="Edit" />
                  <IconBtn icon="ui.delete" danger onClick={() => requestDelete(inv)} title="Delete" />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="type-small-label text-left uppercase bg-elevated text-text">
                  <th className="px-6 py-3.5">Invoice</th>
                  <th className="px-6 py-3.5">Client</th>
                  <th className="px-6 py-3.5">Invoice Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Payment Date</th>
                  <th className="px-6 py-3.5">Payment Account</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-content">
                {sorted.map(({ inv, info }) => (
                  <tr key={inv.id} className={`forge-row border-b last:border-0 ${theme.rowBorder}`}>
                    <td className="type-body px-6 py-4 font-medium whitespace-nowrap">
                      <button type="button" onClick={() => setDetailTarget(inv)} className="hover:underline text-left">{inv.invoiceNumber}</button>
                    </td>
                    <td className="px-6 py-4">{inv.client}</td>
                    <td className={`type-small-label px-6 py-4 whitespace-nowrap ${theme.subtext}`}>{inv.invoiceDate}</td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_STYLES[info.label]}>{info.label}</Badge>
                      {info.sub && <p className={`type-small-label mt-1 ${theme.subtext}`}>{info.sub}</p>}
                    </td>
                    <td className={`type-small-label px-6 py-4 whitespace-nowrap ${theme.subtext}`}>{inv.paymentDate || "—"}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${theme.subtext}`}>{inv.paymentAccountId ? accountName(inv.paymentAccountId) : "—"}</td>
                    <td className="type-body px-6 py-4 text-right font-semibold whitespace-nowrap">{fmt(inv.amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== "Paid" && (
                          <IconBtn icon="invoiceStates.payment" onClick={() => openPayModal(inv)} title="Mark Paid" />
                        )}
                        <IconBtn icon="ui.edit" onClick={() => openEdit(inv)} title="Edit" />
                        <IconBtn icon="ui.delete" danger onClick={() => requestDelete(inv)} title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      {detailTarget && (
        <InvoiceDetailModal
          invoice={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            openEdit(detailTarget);
            setDetailTarget(null);
          }}
        />
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Invoice" : "Edit Invoice"} onClose={() => setModal(null)}>
          <InvoiceForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}

      {generatorTarget && (
        <InvoiceGenerator existing={generatorTarget === "new" ? null : generatorTarget} onClose={() => setGeneratorTarget(null)} />
      )}

      {payModal && (
        <Modal title={`Mark "${payModal.invoiceNumber}" as Paid`} onClose={() => setPayModal(null)}>
          <form onSubmit={confirmPay} className="space-y-4">
            <Field label="Payment Date">
              <DatePicker value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            </Field>
            <Field label="Received into account">
              <div className="flex items-center gap-3">
                {payAccount && <AccountLogo account={data.accounts.find(a => a.id === payAccount)} size="sm" />}
                <div className="flex-1">
                  <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)} required>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                </div>
              </div>
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">Confirm Payment</PrimaryButton>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Invoice" onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-5">
            <AppIcon name="ui.warning" size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <p className={`type-secondary ${theme.subtext}`}>
              This invoice has a linked financial transaction. Deleting the invoice will <strong>not</strong> delete that transaction — you can remove it separately from Transactions if needed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <GhostButton className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>Cancel</GhostButton>
            <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>Delete Invoice</PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
