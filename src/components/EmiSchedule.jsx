import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field } from "./Field";
import { Select } from "./Select";
import { TextInput } from "./TextInput";
import { PrimaryButton } from "./PrimaryButton";
import { GhostButton } from "./GhostButton";
import { Badge } from "./Badge";
import { AppIcon } from "./AppIcon";
import { ProgressBar } from "./ProgressBar";
import { fmt, todayISO } from "../utils/helpers";

const INSTALLMENT_STATUS_STYLES = {
  Paid: "bg-emerald-500/15 text-emerald-300",
  Upcoming: "bg-amber-500/15 text-amber-300",
};

const PLAN_STATUS_STYLES = {
  Active: "bg-accent/12 text-accent",
  Completed: "bg-emerald-500/15 text-emerald-300",
  Cancelled: "bg-white/10 text-white/60",
  Preclosed: "bg-sky-500/15 text-sky-300",
};

// Display text differs from the stored status value only for Preclosed
// ("Pre-closed" reads better than the raw "Preclosed") — every other status
// is shown as-is.
const PLAN_STATUS_LABELS = {
  Preclosed: "Pre-closed",
};

export function EmiSchedule({ plan, onDone }) {
  const { data, theme, payEmiInstallment, unpayEmiInstallment, deleteEmiPlan, precloseEmiPlan, insufficientFundsError, creditCardPaymentError } = useApp();

  const installments = data.emiInstallments
    .filter((i) => i.emiPlanId === plan.id)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  const originalTxn = data.transactions.find((t) => t.id === plan.transactionId);
  const payableAccounts = data.accounts.filter((a) => a.id !== plan.accountId);
  const paidCount = installments.filter((i) => i.status === "Paid").length;
  const pct = installments.length > 0 ? (paidCount / installments.length) * 100 : 0;

  const remainingInstallments = installments.filter((i) => i.status !== "Paid");
  const remainingAmount = remainingInstallments.reduce((s, i) => s + Number(i.amount), 0);
  const canPreclose = plan.status === "Active" && remainingInstallments.length > 0;

  const [payTarget, setPayTarget] = useState(null); // installment | null
  const [payAccount, setPayAccount] = useState(payableAccounts[0]?.id || "");
  const [payDate, setPayDate] = useState(todayISO());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [precloseTarget, setPrecloseTarget] = useState(false); // showing the pre-close form
  const [precloseAccount, setPrecloseAccount] = useState(payableAccounts[0]?.id || "");
  const [precloseDate, setPrecloseDate] = useState(todayISO());
  const [precloseError, setPrecloseError] = useState("");
  const [error, setError] = useState("");

  const startPay = (inst) => {
    setPayTarget(inst);
    setPayAccount(payableAccounts[0]?.id || "");
    setPayDate(todayISO());
    setError("");
  };

  const confirmPay = (e) => {
    e.preventDefault();
    if (!payAccount) {
      setError("Select an account to pay from.");
      return;
    }
    const fundsError = insufficientFundsError(payAccount, payTarget.amount);
    if (fundsError) {
      setError(fundsError);
      return;
    }
    const cardError = creditCardPaymentError(plan.accountId, payTarget.amount);
    if (cardError) {
      setError(cardError);
      return;
    }
    setError("");
    const description = `EMI ${payTarget.installmentNumber}/${plan.tenureMonths} — ${originalTxn?.description || originalTxn?.category || "Purchase"}`;
    payEmiInstallment(payTarget, payAccount, payDate, description);
    setPayTarget(null);
  };

  const confirmDelete = () => {
    deleteEmiPlan(plan.id);
    onDone();
  };

  const startPreclose = () => {
    setPrecloseAccount(payableAccounts[0]?.id || "");
    setPrecloseDate(todayISO());
    setPrecloseError("");
    setPrecloseTarget(true);
  };

  const confirmPreclose = (e) => {
    e.preventDefault();
    if (!precloseAccount) {
      setPrecloseError("Select an account to pay from.");
      return;
    }
    const fundsError = insufficientFundsError(precloseAccount, remainingAmount);
    if (fundsError) {
      setPrecloseError(fundsError);
      return;
    }
    const cardError = creditCardPaymentError(plan.accountId, remainingAmount);
    if (cardError) {
      setPrecloseError(cardError);
      return;
    }
    setPrecloseError("");
    const description = `EMI pre-closure — ${originalTxn?.description || originalTxn?.category || "Purchase"}`;
    precloseEmiPlan(plan.id, precloseAccount, precloseDate, description);
    setPrecloseTarget(false);
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
        <div className="flex items-center justify-between gap-3">
          <p className="type-body font-semibold truncate">{originalTxn?.description || originalTxn?.category || "Purchase"}</p>
          <Badge className={PLAN_STATUS_STYLES[plan.status] || PLAN_STATUS_STYLES.Active}>{PLAN_STATUS_LABELS[plan.status] || plan.status}</Badge>
        </div>
        <p className={`type-secondary mt-0.5 ${theme.subtext}`}>
          {fmt(plan.principal)} · {plan.tenureMonths} months · {plan.interestRate}% p.a.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className={`type-small-label ${theme.subtext}`}>EMI</p>
            <p className="type-body font-semibold mt-0.5">{fmt(plan.emiAmount)}</p>
          </div>
          <div>
            <p className={`type-small-label ${theme.subtext}`}>Total Interest</p>
            <p className="type-body font-semibold mt-0.5">{fmt(plan.totalInterest)}</p>
          </div>
          <div>
            <p className={`type-small-label ${theme.subtext}`}>Total Payable</p>
            <p className="type-body font-semibold mt-0.5">{fmt(plan.totalPayable)}</p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar pct={pct} colorClass="bg-accent" />
          <p className={`type-small-label mt-1.5 ${theme.subtext}`}>{paidCount} of {installments.length} installments paid</p>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {installments.map((inst) => (
          <div key={inst.id} className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 ${theme.rowBorder}`}>
            <div className="min-w-0">
              <p className="type-body font-medium">#{inst.installmentNumber} · {fmt(inst.amount)}</p>
              <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                {inst.status === "Paid" ? `Paid ${inst.paidDate}` : `Due ${inst.dueDate}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={INSTALLMENT_STATUS_STYLES[inst.status]}>{inst.status}</Badge>
              {inst.status === "Paid" ? (
                inst.settledViaPreclosure ? (
                  <span className={`type-small-label ${theme.subtext}`}>Settled by pre-closure</span>
                ) : (
                  <GhostButton onClick={() => unpayEmiInstallment(inst)}>Undo</GhostButton>
                )
              ) : (
                <PrimaryButton onClick={() => startPay(inst)}>Mark Paid</PrimaryButton>
              )}
            </div>
          </div>
        ))}
      </div>

      {payTarget && (
        <form onSubmit={confirmPay} className={`space-y-4 rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
          <p className="type-body font-semibold">Pay installment #{payTarget.installmentNumber} ({fmt(payTarget.amount)})</p>
          <Field label="Pay from">
            <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              {payableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment Date">
            <TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
          </Field>
          {error && <p className="type-secondary text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <GhostButton type="button" className="flex-1 justify-center" onClick={() => setPayTarget(null)}>Cancel</GhostButton>
            <PrimaryButton type="submit" className="flex-1 justify-center">Confirm Payment</PrimaryButton>
          </div>
        </form>
      )}

      {canPreclose && (
        <div className={`border-t pt-4 ${theme.rowBorder}`}>
          {precloseTarget ? (
            <form onSubmit={confirmPreclose} className={`space-y-4 rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
              <div>
                <p className="type-body font-semibold">Pre-close EMI</p>
                <p className={`type-secondary mt-1 ${theme.subtext}`}>
                  {remainingInstallments.length} remaining installment{remainingInstallments.length === 1 ? "" : "s"} · Amount required to close: <span className="font-semibold">{fmt(remainingAmount)}</span>
                </p>
                <p className={`type-secondary mt-1 ${theme.subtext}`}>
                  This will settle the remaining EMI obligation in one payment and mark the plan Pre-closed. Already-paid installments are not affected.
                </p>
              </div>
              <Field label="Pay from">
                <Select value={precloseAccount} onChange={(e) => setPrecloseAccount(e.target.value)}>
                  {payableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Settlement Date">
                <TextInput type="date" value={precloseDate} onChange={(e) => setPrecloseDate(e.target.value)} required />
              </Field>
              {precloseError && <p className="type-secondary text-red-500">{precloseError}</p>}
              <div className="flex items-center gap-3">
                <GhostButton type="button" className="flex-1 justify-center" onClick={() => setPrecloseTarget(false)}>Cancel</GhostButton>
                <PrimaryButton type="submit" className="flex-1 justify-center">Pre-close EMI</PrimaryButton>
              </div>
            </form>
          ) : (
            <GhostButton className="w-full justify-center" onClick={startPreclose}>
              Pre-close EMI ({fmt(remainingAmount)} remaining)
            </GhostButton>
          )}
        </div>
      )}

      <div className={`border-t pt-4 ${theme.rowBorder}`}>
        {confirmingDelete ? (
          <div className="space-y-3">
            <p className="type-secondary text-red-500">
              Delete this EMI plan? Paid installments and their transactions stay in your history — only the plan and its schedule are removed. This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <GhostButton className="flex-1 justify-center" onClick={() => setConfirmingDelete(false)}>Cancel</GhostButton>
              <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>Delete EMI Plan</PrimaryButton>
            </div>
          </div>
        ) : (
          <GhostButton className="w-full justify-center" onClick={() => setConfirmingDelete(true)}>
            <AppIcon name="ui.delete" size={14} /> Delete EMI Plan
          </GhostButton>
        )}
      </div>
    </div>
  );
}
