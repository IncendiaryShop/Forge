import { useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import { PrimaryButton } from "./PrimaryButton";
import { GhostButton } from "./GhostButton";
import { IconBtn } from "./IconBtn";
import { AppIcon } from "./AppIcon";

export function ManageClientsModal({ onClose, onLoad }) {
  const { data, theme, deleteClient } = useApp();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    await deleteClient(pendingDelete.id);
    setBusy(false);
    setPendingDelete(null);
  };

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-4 ${theme.modalOverlay}`} data-no-rubber-band>
      <div className={`w-full max-w-md rounded-[20px] border ${theme.border} ${theme.card} p-5 sm:p-6 space-y-4`}>
        <div className="flex items-center justify-between">
          <h2 className="type-section-title">Saved Clients</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`forge-button p-2 rounded-[10px] ${theme.hover}`}>
            <AppIcon name="ui.close" size={16} />
          </button>
        </div>

        {pendingDelete ? (
          <div className="space-y-4">
            <p className="type-secondary">Delete <strong className="text-text">{pendingDelete.name}</strong>? This only removes the saved client — invoices already generated from it are unaffected.</p>
            <div className="flex items-center gap-2">
              <GhostButton className="flex-1 justify-center" onClick={() => setPendingDelete(null)}>Cancel</GhostButton>
              <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete} disabled={busy}>
                {busy ? "Deleting..." : "Delete"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <>
            {!data.clients?.length ? (
              <p className={`type-secondary ${theme.subtext}`}>No saved clients yet. Save one from the Bill To section.</p>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto forge-scroll-contain">
                {data.clients.map((c) => (
                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] border ${theme.border}`}>
                    <div className="flex-1 min-w-0">
                      <p className="type-secondary font-medium truncate">{c.name}</p>
                      {c.email && <p className={`type-small-label truncate ${theme.subtext}`}>{c.email}</p>}
                    </div>
                    <GhostButton onClick={() => onLoad(c.id)}>Use</GhostButton>
                    <IconBtn icon="ui.delete" danger title="Delete" onClick={() => setPendingDelete(c)} />
                  </div>
                ))}
              </div>
            )}
            <GhostButton className="w-full justify-center" onClick={onClose}>Close</GhostButton>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
