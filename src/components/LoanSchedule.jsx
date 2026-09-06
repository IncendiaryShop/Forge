import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field } from "./Field";
import { Select } from "./Select";
import { DatePicker } from "./DatePicker";
import { PrimaryButton } from "./PrimaryButton";
import { GhostButton } from "./GhostButton";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";
import { fmt, todayISO } from "../utils/helpers";

const INSTALLMENT_STATUS_STYLES = {
  Paid: "bg-success/15 text-success",
  Upcoming: "bg-warning/15 text-warning",
  Preclosed: "bg-white/10 text-subtext",
};

const LOAN_STATUS_STYLES = {
  Active: "bg-accent/12 text-accent",
  Completed: "bg-success/15 text-success",
  Preclosed: "bg-white/10 text-subtext",
};

const STATUS_LABELS = {
  Preclosed: "Pre-closed",
};

export function LoanSchedule({ account }) {
  const { data, theme, payLoanInstallment, precloseLoan, insufficientFundsError, loanOutstandingPrincipal } = useApp();

  const installments = data.loanInstallments
    .filter((i) => i.accountId === account.id)
    .sort((a, b) => a.installmentNumber - b.installmentNumber);

  const payableAccounts = data.accounts.filter((a) => a.type === "Bank" || a.type === "Cash");
  const paidCount = installments.filter((i) => i.status === "Paid").length;
  const pct = installments.length > 0 ? (paidCount / installments.length) * 100 : 0;

  const outstanding = loanOutstandingPrincipal(account.id);

  const remainingInstallments = installments.filter((i) => i.status === "Upcoming");
  const loanStatus = account.loanStatus || "Active";
  const canPreclose = loanStatus === "Active" && outstanding > 0 && remainingInstallments.length > 0;

  const [payTarget, setPayTarget] = useState(null);
  const [payAccount, setPayAccount] = useState(payableAccounts[0]?.id || "");
  const [payDate, setPayDate] = useState(todayISO());
  const [error, setError] = useState("");

  const [precloseTarget, setPrecloseTarget] = useState(false);
  const [precloseAccount, setPrecloseAccount] = useState(payableAccounts[0]?.id || "");
  const [precloseDate, setPrecloseDate] = useState(todayISO());
  const [precloseError, setPrecloseError] = useState("");

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
    const fundsError = insufficientFundsError(payAccount, payTarget.emiAmount);
    if (fundsError) {
      setError(fundsError);
      return;
    }
    setError("");
    const description = `Loan EMI ${payTarget.installmentNumber} — ${account.name}`;
    payLoanInstallment(payTarget, payAccount, payDate, description);
    setPayTarget(null);
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
    const fundsError = insufficientFundsError(precloseAccount, outstanding);
    if (fundsError) {
      setPrecloseError(fundsError);
      return;
    }
    setPrecloseError("");
    const description = `Loan pre-closure — ${account.name}`;
    precloseLoan(account.id, precloseAccount, precloseDate, description);
    setPrecloseTarget(false);
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
        <div className="flex items-center justify-between gap-3">
          <p className="type-body font-semibold truncate">{account.name}</p>
          <Badge className={LOAN_STATUS_STYLES[loanStatus] || LOAN_STATUS_STYLES.Active}>{STATUS_LABELS[loanStatus] || loanStatus}</Badge>
        </div>
        <p className={`type-secondary mt-0.5 ${theme.subtext}`}>
          {fmt(account.opening)} original principal · {account.loanTenureMonths} months · {account.loanInterestRate}% p.a.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className={`type-small-label ${theme.subtext}`}>EMI</p>
            <p className="type-body font-semibold mt-0.5">{fmt(account.loanEmiAmount)}</p>
          </div>
          <div>
            <p className={`type-small-label ${theme.subtext}`}>Outstanding Principal</p>
            <p className="type-body font-semibold mt-0.5">{fmt(outstanding)}</p>
          </div>
          <div>
            <p className={`type-small-label ${theme.subtext}`}>Original Principal</p>
            <p className="type-body font-semibold mt-0.5">{fmt(account.opening)}</p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar pct={pct} colorClass="bg-accent" />
          <p className={`type-small-label mt-1.5 ${theme.subtext}`}>{paidCount} of {installments.length} installments paid</p>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 forge-scroll-contain">
        {installments.map((inst) => (
          <div key={inst.id} className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 ${theme.rowBorder}`}>
            <div className="min-w-0">
              <p className="type-body font-medium">#{inst.installmentNumber} · {fmt(inst.emiAmount)}</p>
              <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                {inst.status === "Upcoming" ? `Due ${inst.dueDate}` : `${STATUS_LABELS[inst.status] || inst.status} ${inst.paidDate || ""}`} · Principal {fmt(inst.principalComponent)} · Interest {fmt(inst.interestComponent)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={INSTALLMENT_STATUS_STYLES[inst.status]}>{STATUS_LABELS[inst.status] || inst.status}</Badge>
              {inst.status === "Upcoming" && (
                <PrimaryButton onClick={() => startPay(inst)}>Mark Paid</PrimaryButton>
              )}
            </div>
          </div>
        ))}
      </div>

      {payTarget && (
        <form onSubmit={confirmPay} className={`space-y-4 rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
          <p className="type-body font-semibold">Pay installment #{payTarget.installmentNumber} ({fmt(payTarget.emiAmount)})</p>
          <p className={`type-secondary ${theme.subtext}`}>
            Principal {fmt(payTarget.principalComponent)} · Interest {fmt(payTarget.interestComponent)}
          </p>
          <Field label="Pay from">
            <Select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              {payableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Payment Date">
            <DatePicker value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
          </Field>
          {error && <p className="type-secondary text-danger">{error}</p>}
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
                <p className="type-body font-semibold">Pre-close Loan</p>
                <p className={`type-secondary mt-1 ${theme.subtext}`}>
                  {remainingInstallments.length} remaining installment{remainingInstallments.length === 1 ? "" : "s"} · Settlement amount: <span className="font-semibold">{fmt(outstanding)}</span>
                </p>
                <p className={`type-secondary mt-1 ${theme.subtext}`}>
                  This will settle the entire remaining Outstanding Principal in one payment and mark the loan Pre-closed. Already-paid installments are not affected.
                </p>
              </div>
              <Field label="Pay from">
                <Select value={precloseAccount} onChange={(e) => setPrecloseAccount(e.target.value)}>
                  {payableAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Settlement Date">
                <DatePicker value={precloseDate} onChange={(e) => setPrecloseDate(e.target.value)} required />
              </Field>
              {precloseError && <p className="type-secondary text-danger">{precloseError}</p>}
              <div className="flex items-center gap-3">
                <GhostButton type="button" className="flex-1 justify-center" onClick={() => setPrecloseTarget(false)}>Cancel</GhostButton>
                <PrimaryButton type="submit" className="flex-1 justify-center">Pre-close Loan</PrimaryButton>
              </div>
            </form>
          ) : (
            <GhostButton className="w-full justify-center" onClick={startPreclose}>
              Pre-close Loan ({fmt(outstanding)} remaining)
            </GhostButton>
          )}
        </div>
      )}
    </div>
  );
}
