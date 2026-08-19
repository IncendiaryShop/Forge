import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, Select, TextInput, PrimaryButton, GhostButton } from "../components";
import { fmt, todayISO } from "../utils/helpers";
import { generateLoanSchedule } from "../utils/loanAmortization";

export function LoanDisburseForm({ account, onDone }) {
  const { data, theme, disburseLoan } = useApp();
  const destinationAccounts = data.accounts.filter((a) => a.type === "Bank" || a.type === "Cash");

  const [destinationId, setDestinationId] = useState(destinationAccounts[0]?.id || "");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");

  const schedule = useMemo(
    () => generateLoanSchedule(account.opening, account.loanInterestRate, account.loanTenureMonths, account.loanEmiAmount, account.loanStartDate),
    [account]
  );
  const totalInterest = schedule.reduce((s, i) => s + i.interestComponent, 0);
  const totalPayable = schedule.reduce((s, i) => s + i.emiAmount, 0);

  const submit = (e) => {
    e.preventDefault();
    if (!destinationId) {
      setError("Select an account to receive the loan.");
      return;
    }
    if (schedule.length === 0) {
      setError("This loan's terms aren't complete enough to generate a schedule. Edit the account and fill in interest rate, tenure, EMI, and start date.");
      return;
    }
    setError("");
    disburseLoan(account.id, destinationId, date, schedule, `Loan disbursement — ${account.name}`);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={`rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
        <p className="type-body font-semibold">{account.name}</p>
        <p className={`type-secondary mt-0.5 ${theme.subtext}`}>
          {fmt(account.opening)} principal · {account.loanTenureMonths} months · {account.loanInterestRate}% p.a.
        </p>
      </div>

      <Field label="Disburse into">
        <Select value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
          {destinationAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>

      <Field label="Disbursement Date">
        <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>

      {schedule.length > 0 && (
        <div className={`rounded-[14px] border p-4 space-y-2 ${theme.border} bg-white/[0.02]`}>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Monthly EMI</span>
            <span className="type-body font-semibold">{fmt(schedule[0].emiAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Total Interest</span>
            <span className="type-body font-semibold">{fmt(totalInterest)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Total Payable</span>
            <span className="type-body font-semibold">{fmt(totalPayable)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Installments</span>
            <span className="type-body font-semibold">{schedule.length}</span>
          </div>
        </div>
      )}

      {error && <p className="type-secondary text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <GhostButton type="button" className="flex-1 justify-center" onClick={onDone}>Cancel</GhostButton>
        <PrimaryButton type="submit" className="flex-1 justify-center">Disburse Loan</PrimaryButton>
      </div>
    </form>
  );
}
