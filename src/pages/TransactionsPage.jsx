import { useState, useMemo, useCallback } from "react";
import { Search, Download, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, Badge, GhostButton, PrimaryButton, IconBtn, Modal, EmptyState, AppIcon } from "../components";
import { TransactionForm } from "../forms/TransactionForm";
import { hashColorClasses, fmt } from "../utils/helpers";
import { sortTransactionsDesc } from "../utils/transactionUtils";

export function TransactionsPage() {
  const { data, theme, deleteTransaction } = useApp();
  const [modal, setModal] = useState(null); // 'new' | txn object | null
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const accountName = useCallback(
    (id) => data.accounts.find(a => a.id === id)?.name || "—",
    [data.accounts]
  );

  const txnIconName = (t) => {
    if (t.type === "Income") return "transactionTypes.income";
    if (t.type === "Transfer") return "transactionTypes.transfer";
    return `categories.${(t.category || "").toLowerCase()}`;
  };

  const confirmDelete = () => {
    deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
  };

  const filtered = useMemo(() => {
    const list = data.transactions
      .filter(t => (typeFilter === "All" || t.type === typeFilter))
      .filter(t => (catFilter === "All" || t.category === catFilter))
      .filter(t => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (t.description || "").toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || accountName(t.account).toLowerCase().includes(q);
      });
    return sortTransactionsDesc(list);
  }, [data.transactions, search, typeFilter, catFilter, accountName]);

  const allCats = [...new Set(data.transactions.map(t => t.category))];

  const exportCsv = () => {
    const header = "Date,Type,Category,Description,Account,Amount\n";
    const rows = filtered.map(t => `${t.date},${t.type},${t.category},"${(t.description || "").replace(/"/g, '""')}",${accountName(t.account)},${t.amount}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filterSelectCls = `forge-control px-3.5 py-2.5 rounded-[14px] border text-base outline-none w-auto ${theme.input}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative">
            <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.subtext}`} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..."
              className={`forge-control pl-9 pr-3.5 py-2.5 rounded-[14px] border text-base outline-none w-56 ${theme.input}`} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={filterSelectCls}>
            <option value="All">All</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={filterSelectCls}>
            <option value="All">All</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2.5">
          <GhostButton onClick={exportCsv}><Download size={14} /> Export CSV</GhostButton>
          <PrimaryButton onClick={() => setModal("new")}><Plus size={15} /> Add Transaction</PrimaryButton>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={(p) => <AppIcon name="dashboard.recent" {...p} />} title="No transactions found" subtitle="Try adjusting your filters or add a new transaction" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className={`type-small-label text-left uppercase ${theme.tableHeader} border-b ${theme.rowBorder}`}>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Account</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className={`forge-row border-b last:border-0 ${theme.rowBorder}`}>
                    <td className={`type-small-label px-6 py-4 whitespace-nowrap ${theme.subtext}`}>{t.date}</td>
                    <td className="type-body px-6 py-4 font-medium">
                      <div className="flex items-center gap-2.5">
                        <AppIcon name={txnIconName(t)} size={14} className={theme.subtext} />
                        <span>{t.description || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Badge className={hashColorClasses(t.category)}>{t.category}</Badge></td>
                    <td className={`px-6 py-4 ${theme.subtext}`}>{accountName(t.account)}{t.type === "Transfer" && t.transferAccount ? ` → ${accountName(t.transferAccount)}` : ""}</td>
                    <td className={`type-body px-6 py-4 text-right font-semibold whitespace-nowrap ${t.type === "Income" ? "text-emerald-500" : t.type === "Transfer" ? theme.subtext : ""}`}>
                      {t.type === "Income" ? "+" : t.type === "Expense" ? "-" : ""}{fmt(t.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn icon={Pencil} onClick={() => setModal(t)} title="Edit" />
                        <IconBtn icon={Trash2} danger onClick={() => setDeleteTarget(t)} title="Delete" />
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
        <Modal title={modal === "new" ? "Add Transaction" : "Edit Transaction"} onClose={() => setModal(null)}>
          <TransactionForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Transaction" onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-5">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <p className={`type-secondary ${theme.subtext}`}>
              Are you sure you want to delete <strong>{deleteTarget.description || deleteTarget.category}</strong>? This cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <GhostButton className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>Cancel</GhostButton>
            <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>Delete Transaction</PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}