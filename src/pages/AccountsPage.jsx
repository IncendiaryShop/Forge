import { useState } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, PrimaryButton, GhostButton, IconBtn, Modal, AccountLogo } from "../components";
import { AccountForm } from "../forms/AccountForm";
import { fmt } from "../utils/helpers";

export function AccountsPage() {
  const { data, theme, accountBalance, deleteAccount } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { account, refCount } | null

  const referenceCount = (accountId) =>
    data.transactions.filter(t => t.account === accountId || t.transferAccount === accountId).length;

  const requestDelete = (account) => {
    setDeleteTarget({ account, refCount: referenceCount(account.id) });
  };

  const confirmDelete = () => {
    if (deleteTarget.refCount > 0) return;
    deleteAccount(deleteTarget.account.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setModal("new")}><Plus size={15} /> Add Account</PrimaryButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.accounts.map(a => {
          const bal = accountBalance(a.id);
          return (
            <Card key={a.id} className="p-7 relative group">
              <div className="flex items-start justify-between">
                <AccountLogo account={a} size="md" />
                <div className="forge-card-actions flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <IconBtn icon={Pencil} onClick={() => setModal(a)} title="Edit" />
                  <IconBtn icon={Trash2} danger onClick={() => requestDelete(a)} title="Delete" />
                </div>
              </div>
              <p className="type-body font-semibold mt-4">{a.name}</p>
              <p className={`type-secondary ${theme.subtext}`}>{a.type}</p>
              <p className={`type-display-number mt-3 ${bal < 0 ? "text-red-500" : ""}`}>{fmt(bal)}</p>
            </Card>
          );
        })}
      </div>
      {modal && (
        <Modal title={modal === "new" ? "Add Account" : "Edit Account"} onClose={() => setModal(null)}>
          <AccountForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="Delete Account" onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-5">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            {deleteTarget.refCount > 0 ? (
              <p className={`type-secondary ${theme.subtext}`}>
                <strong>{deleteTarget.account.name}</strong> is referenced by {deleteTarget.refCount} transaction{deleteTarget.refCount === 1 ? "" : "s"}. Deleting it would leave those transactions pointing at a missing account, so deletion is blocked. Reassign or remove those transactions first.
              </p>
            ) : (
              <p className={`type-secondary ${theme.subtext}`}>
                Are you sure you want to delete <strong>{deleteTarget.account.name}</strong>? This cannot be undone.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <GhostButton className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>
              {deleteTarget.refCount > 0 ? "Close" : "Cancel"}
            </GhostButton>
            {deleteTarget.refCount === 0 && (
              <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>
                Delete Account
              </PrimaryButton>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}