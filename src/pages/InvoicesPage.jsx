import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Card, Badge, PrimaryButton, IconBtn, Modal, EmptyState, Field, Select, GhostButton, TextInput, AppIcon, AccountLogo } from "../components";
import { InvoiceForm } from "../forms/InvoiceForm";
import { fmt, todayISO } from "../utils/helpers";

const STATUS_STYLES = {
  OVERDUE: "bg-rose-500/15 text-rose-300",
  UNPAID: "bg-amber-500/15 text-amber-300",
  PAID: "bg-emerald-500/15 text-emerald-300",
};

function getInvoiceInfo(invoice, today) {
  if (invoice.status === "Paid") {
    return { group: 2, label: "PAID", sub: invoice.paymentDate ? `Paid ${invoice.paymentDate}` : "" };
  }
  if (invoice.invoiceDate < today) {
    return { group: 0, label: "OVERDUE", sub: "" };
  }
  if (invoice.invoiceDate === today) {
    return { group: 1, label: "UNPAID", sub: "Due Today" };
  }
  return { group: 1, label: "UNPAID", sub: "" };
}

export function InvoicesPage() {
  const { data, theme, deleteInvoice, markInvoicePaid } = useApp();
  const [modal, setModal] = useState(null); // 'new' | invoice | null
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
      <div className="flex justify-end">
  <PrimaryButton onClick={() => setModal("new")}>
    <AppIcon name="ui.add" size={15} /> Add Invoice
  </PrimaryButton>
</div>

      <Card className="overflow-hidden">

  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">

    <div>
      <h3 className="type-section-title">
        Total Invoices
      </h3>

      <p className={`type-small-label mt-1 ${theme.subtext}`}>
        {sorted.length} {sorted.length === 1 ? "invoice" : "invoices"}
      </p>
    </div>

    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className={`forge-control px-3 py-2 rounded-[10px] border text-[13px] outline-none ${theme.input}`}
    >
      <option value="ALL">All Invoices</option>
      <option value="UNPAID">Unpaid</option>
      <option value="PAID">Paid</option>
    </select>

  </div>

  {sorted.length === 0 ? (
          <EmptyState icon={(p) => <AppIcon name="invoiceStates.invoice" {...p} />} title="No invoices yet" subtitle="Add your first invoice to start tracking payments" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className={`type-small-label text-left uppercase ${theme.tableHeader} border-b ${theme.rowBorder}`}>
                  <th className="px-6 py-4">Invoice</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Invoice Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment Date</th>
                  <th className="px-6 py-4">Payment Account</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ inv, info }) => (
                  <tr key={inv.id} className={`forge-row border-b last:border-0 ${theme.rowBorder}`}>
                    <td className="type-body px-6 py-4 font-medium whitespace-nowrap">{inv.invoiceNumber}</td>
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
                        <IconBtn icon="ui.edit" onClick={() => setModal(inv)} title="Edit" />
                        <IconBtn icon="ui.delete" danger onClick={() => requestDelete(inv)} title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={modal === "new" ? "Add Invoice" : "Edit Invoice"} onClose={() => setModal(null)}>
          <InvoiceForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}

      {payModal && (
        <Modal title={`Mark "${payModal.invoiceNumber}" as Paid`} onClose={() => setPayModal(null)}>
          <form onSubmit={confirmPay} className="space-y-4">
            <Field label="Payment Date">
              <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
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