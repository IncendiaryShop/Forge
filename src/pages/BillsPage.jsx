import { useState } from "react";
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
  Badge,
  EmiSchedule,
} from "../components";
import { BillForm } from "../forms/BillForm";
import { fmt } from "../utils/helpers";
import { computeBillStatus } from "../utils/billCycle";
import { resolveBillDisplay } from "../utils/billRegistry";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${MONTH_ABBR[m - 1]} ${y}`;
}

export function BillsPage() {
  const { data, theme, deleteBill, toggleBillPaid, insufficientFundsError } = useApp();

  const [modal, setModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAccount, setPayAccount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [undoTarget, setUndoTarget] = useState(null);
  const [emiScheduleForId, setEmiScheduleForId] = useState(null); // emi plan id | null
  const [payError, setPayError] = useState("");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = [...data.bills].sort((a, b) => a.dueDay - b.dueDay);

  // EMI Payments — reads from the same emi_plans/emi_installments data the
  // Transactions page's EMI Schedule modal already uses (see App.jsx);
  // nothing here creates, converts, or duplicates any EMI or transaction
  // record. Only 'Active' plans qualify — Completed/Cancelled/Preclosed
  // plans have nothing left to pay and are intentionally excluded here.
  const activeEmiRows = (data.emiPlans || [])
    .filter((plan) => plan.status === "Active")
    .map((plan) => {
      const installments = (data.emiInstallments || []).filter((i) => i.emiPlanId === plan.id);
      const paidCount = installments.filter((i) => i.status === "Paid").length;
      const nextUnpaid = installments
        .filter((i) => i.status !== "Paid")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;

      return {
        plan,
        txn: data.transactions.find((t) => t.id === plan.transactionId) || null,
        account: data.accounts.find((a) => a.id === plan.accountId) || null,
        paidCount,
        totalCount: installments.length || plan.tenureMonths,
        nextDueDate: nextUnpaid?.dueDate || null,
      };
    })
    .sort((a, b) => {
      if (!a.nextDueDate && !b.nextDueDate) return 0;
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return a.nextDueDate.localeCompare(b.nextDueDate);
    });

  const emiScheduleForPlan = data.emiPlans.find((p) => p.id === emiScheduleForId) || null;

  const openPayModal = (bill) => {
    setPayAccount(bill.account || data.accounts[0]?.id || "");
    setPayError("");
    setPayModal(bill);
  };

  const confirmPay = (e) => {
    e.preventDefault();

    if (!payAccount) return;

    const fundsError = insufficientFundsError(payAccount, payModal.amount);
    if (fundsError) {
      setPayError(fundsError);
      return;
    }

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
          <AppIcon name="ui.add" size={18} />
          Add Bill
        </PrimaryButton>
      </div>

      <Card>
        {sorted.length === 0 ? (
          <EmptyState
            icon={(p) => <AppIcon name="bills.due" {...p} />}
            title="No recurring payments"
            description="Add a recurring bill or subscription to start tracking payments."
            action={
              <PrimaryButton onClick={() => setModal("new")}>
                <AppIcon name="ui.add" size={18} />
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
                    className={`forge-button w-6 h-6 rounded-full flex items-center justify-center shrink-0   ${
                      b.paid
                        ? ""
                        : theme.border
                    }`}
                    title={b.paid ? "Paid" : "Unpaid"}
                  >
                    {b.paid && <AppIcon name="bills.paid" size={15} />}
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
                    icon="ui.edit"
                    title="Edit"
                    onClick={() => setModal(b)}
                  />

                  <IconBtn
                    icon="ui.delete"
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

      {/* ================= EMI Payments ================= */}
      <div className="space-y-4">
        <h2 className="type-section-title">EMI Payments</h2>

        <Card>
          {activeEmiRows.length === 0 ? (
            <EmptyState
              icon={(p) => <AppIcon name="ui.emi" {...p} />}
              title="No active EMI plans"
              subtitle="Convert a Credit Card expense to EMI from the Transactions page."
            />
          ) : (
            activeEmiRows.map(({ plan, txn, account, paidCount, totalCount, nextDueDate }) => (
              <div
                key={plan.id}
                className={`flex items-center justify-between px-6 py-5 border-b last:border-0 ${theme.rowBorder}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AppIcon name="ui.emi" size="md" container />

                  <div className="min-w-0">
                    <p className="type-body font-medium truncate">
                      {txn?.description || txn?.category || "EMI"}
                    </p>

                    <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                      {account?.name || "—"} · {fmt(plan.emiAmount)}/month
                    </p>

                    <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                      {paidCount} of {totalCount} installments paid
                      {nextDueDate && ` · Next due: ${formatDueDate(nextDueDate)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge className="!bg-accent/12 !text-accent !border-0">{plan.status}</Badge>

                  <GhostButton onClick={() => setEmiScheduleForId(plan.id)}>
                    View Schedule
                  </GhostButton>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

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

            {payError && <p className="type-secondary text-red-500">{payError}</p>}

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

      {/* ================= EMI Schedule Modal ================= */}
      {emiScheduleForPlan && (
        <Modal
          title="EMI Schedule"
          onClose={() => setEmiScheduleForId(null)}
          wide
        >
          <EmiSchedule
            plan={emiScheduleForPlan}
            onDone={() => setEmiScheduleForId(null)}
          />
        </Modal>
      )}
    </div>
  );
}