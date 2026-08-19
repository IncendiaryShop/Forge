import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, PrimaryButton, GhostButton } from "../components";
import { fmt, todayISO } from "../utils/helpers";
import { calculateEmi } from "../utils/emi";

export function EmiConvertForm({ transaction, onDone }) {
  const { data, theme, convertToEmi } = useApp();
  const account = data.accounts.find((a) => a.id === transaction.account);
  const principal = Number(transaction.amount) || 0;

  const [tenureMonths, setTenureMonths] = useState(3);
  const [interestRate, setInterestRate] = useState(0);
  const [startDate, setStartDate] = useState(todayISO());
  const [error, setError] = useState("");

  const calc = useMemo(
    () => calculateEmi(principal, Number(interestRate) || 0, Number(tenureMonths) || 0),
    [principal, interestRate, tenureMonths]
  );

  const submit = (e) => {
    e.preventDefault();

    const tenure = Number(tenureMonths);
    if (!Number.isInteger(tenure) || tenure <= 0) {
      setError("Tenure must be a whole number of months greater than 0.");
      return;
    }
    const rate = Number(interestRate);
    if (interestRate === "" || Number.isNaN(rate) || rate < 0) {
      setError("Interest rate can't be negative.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    if (!(principal > 0)) {
      setError("The original transaction amount must be greater than 0.");
      return;
    }
    if (!account || account.type !== "Credit Card") {
      setError("This transaction's account is not a Credit Card.");
      return;
    }
    setError("");

    convertToEmi(transaction.id, {
      accountId: account.id,
      principal,
      interestRate: rate,
      tenureMonths: tenure,
      emiAmount: calc.emiAmount,
      totalInterest: calc.totalInterest,
      totalPayable: calc.totalPayable,
      startDate,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={`rounded-[14px] border p-4 ${theme.border} bg-white/[0.02]`}>
        <p className="type-body font-semibold">{transaction.description || transaction.category}</p>
        <p className={`type-secondary mt-0.5 ${theme.subtext}`}>
          {transaction.category} · {transaction.date} · {account?.name || "—"}
        </p>
      </div>

      <Field label="Principal Amount (₹)">
        <TextInput value={fmt(principal)} disabled />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tenure (months)">
          <TextInput type="number" min="1" step="1" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} required />
        </Field>
        <Field label="Interest Rate (% p.a.)">
          <TextInput type="number" min="0" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
        </Field>
      </div>

      <Field label="Start Date">
        <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </Field>

      <div className={`rounded-[14px] border p-4 space-y-2 ${theme.border} bg-white/[0.02]`}>
        <div className="flex items-center justify-between">
          <span className={`type-secondary ${theme.subtext}`}>Monthly EMI</span>
          <span className="type-body font-semibold">{fmt(calc.emiAmount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`type-secondary ${theme.subtext}`}>Total Interest</span>
          <span className="type-body font-semibold">{fmt(calc.totalInterest)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`type-secondary ${theme.subtext}`}>Total Payable</span>
          <span className="type-body font-semibold">{fmt(calc.totalPayable)}</span>
        </div>
      </div>

      {error && <p className="type-secondary text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <GhostButton type="button" className="flex-1 justify-center" onClick={onDone}>Cancel</GhostButton>
        <PrimaryButton type="submit" className="flex-1 justify-center">Convert to EMI</PrimaryButton>
      </div>
    </form>
  );
}
