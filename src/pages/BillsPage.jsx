import { useState } from "react";
import {
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  CalendarDays,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Card,
  PrimaryButton,
  GhostButton,
  IconBtn,
  Modal,
  EmptyState,
  Field,
  Select,
  ServiceLogo,
  AppIcon,
  AccountLogo,
} from "../components";
import { BillForm } from "../forms/BillForm";
import { fmt } from "../utils/helpers";
import { computeBillStatus } from "../utils/billCycle";
import { resolveBillDisplay } from "../utils/billRegistry";

export function BillsPage() {
  const { data, theme, deleteBill, toggleBillPaid } = useApp();

  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAccount, setPayAccount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoTarget, setUndoTarget] = useState(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = [...data.bills].sort((a, b) => a.dueDay - b.dueDay);

  const openPayModal = (bill) => {
    setPayAccount(bill.account || data.accounts[0]?.id || "");
    setPayModal(bill);
  };

  const confirmPay = (e) => {
    e.preventDefault();

    if (!payAccount) return;

    toggleBillPaid(payModal.id, payAccount);
    setPayModal(null);
  };

  const confirmDelete = () => {
    deleteBill(deleteTarget.id);
    setDeleteTarget(null);
  };

  const confirmUndo = () => {
    toggleBillPaid(undoTarget.id);
    setUndoTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
         <PrimaryButton onClick={() => setModal("new")}>
          <Plus size={18} />
          Add Bill
        </PrimaryButton>
      </div>

      <Card>
        {sorted.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No recurring payments"
            description="Add a recurring bill or subscription to start tracking payments."
            action={
              <PrimaryButton onClick={() => setModal("new")}>
                <Plus size={18} />
                Add Bill
              </PrimaryButton>
            }
          />
        ) : (
          sorted.map((b) => {
            const overdue =
              !b.paid && computeBillStatus(b, today).overdue;
            const display = resolveBillDisplay(b);

            return (
              <div
                key={b.id}
                className={`flex items-center justify-between px-6 py-5 border-b last:border-0 ${theme.rowBorder}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Current-cycle payment status */}
                  <div
                    className={`forge-button w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                      b.paid
                        ? "bg-emerald-500 border-emerald-500"
                        : theme.border
                    }`}
                    title={b.paid ? "Paid" : "Unpaid"}
                  >
                    {b.paid && <CheckCircle2 size={14} />}
                  </div>

                  {/* Brand logo OR semantic bill icon */}
                  {display.kind === "brand" ? (
                    <ServiceLogo provider={display.providerId} size="sm" />
                  ) : (
                    <AppIcon
                      name={display.icon}
                      size="md"
                      container
                    />
                  )}

                  {/* Bill information */}
                  <div className="min-w-0">
                    <p className="type-body font-medium truncate">
                      {b.name}
                    </p>

                    <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                      {b.category} · Due day {b.dueDay}

                      {overdue && (
                        <span className="text-red-500 font-medium">
                          {" "}
                          · Overdue
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    <p className="type-body font-semibold">
                      {fmt(b.amount)}
                    </p>
                  </div>

                  {b.paid ? (
                    <GhostButton onClick={() => setUndoTarget(b)}>
                      Undo Payment
                    </GhostButton>
                  ) : (
                    <PrimaryButton onClick={() => openPayModal(b)}>
                      Mark Paid
                    </PrimaryButton>
                  )}

                  <IconBtn
                    icon={Pencil}
                    title="Edit"
                    onClick={() => setModal(b)}
                  />

                  <IconBtn
                    icon={Trash2}
                    danger
                    title="Delete"
                    onClick={() => setDeleteTarget(b)}
                  />
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Add / Edit Bill */}
      {modal && (
        <Modal
          title={modal === "new" ? "Add Bill" : "Edit Bill"}
          onClose={() => setModal(null)}
        >
          <BillForm
            existing={modal === "new" ? null : modal}
            onDone={() => setModal(null)}
          />
        </Modal>
      )}

      {/* Mark Paid */}
      {payModal && (
        <Modal
          title={`Mark "${payModal.name}" as Paid`}
          onClose={() => setPayModal(null)}
        >
          <form onSubmit={confirmPay} className="space-y-5">
            <Field label="Payment Account">
              <div className="flex items-center gap-3">
                {payAccount && (
                  <AccountLogo
                    account={data.accounts.find((a) => a.id === payAccount)}
                    size="sm"
                  />
                )}

                <div className="flex-1">
                  <Select
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    required
                  >
                    <option value="">Select account</option>

                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Field>

            <div className="flex gap-3">
              <GhostButton
                type="button"
                className="flex-1 justify-center"
                onClick={() => setPayModal(null)}
              >
                Cancel
              </GhostButton>

              <PrimaryButton
                type="submit"
                className="flex-1 justify-center"
              >
                Confirm Payment
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Undo Payment */}
      {undoTarget && (
        <Modal
          title="Undo Payment"
          onClose={() => setUndoTarget(null)}
        >
          <div className="space-y-5">
            <p className={`type-secondary ${theme.subtext}`}>
              Undo this payment? This will mark{" "}
              <strong>{undoTarget.name}</strong> unpaid for this cycle
              {undoTarget.paidTransactionId &&
                " and remove the transaction created for this bill"}
              .
            </p>

            <div className="flex gap-3">
              <GhostButton
                className="flex-1 justify-center"
                onClick={() => setUndoTarget(null)}
              >
                Cancel
              </GhostButton>

              <PrimaryButton
                className="flex-1 justify-center"
                onClick={confirmUndo}
              >
                Undo Payment
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Bill */}
      {deleteTarget && (
        <Modal
          title="Delete Bill"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-5">
            <p className={`type-secondary ${theme.subtext}`}>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name}</strong>?

              {deleteTarget.paidTransactionId && (
                <>
                  {" "}
                  This bill has a linked payment transaction — deleting
                  the bill will not delete that transaction; you can
                  remove it separately from Transactions if needed.
                </>
              )}

              {" "}This cannot be undone.
            </p>

            <div className="flex gap-3">
              <GhostButton
                className="flex-1 justify-center"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </GhostButton>

              <PrimaryButton
                className="flex-1 justify-center"
                onClick={confirmDelete}
              >
                Delete Bill
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}