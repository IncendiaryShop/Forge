import { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, Select, PrimaryButton, GhostButton, DatePicker } from "../components";
import { fmt, todayISO } from "../utils/helpers";
import { computeManualEmiTotals } from "../utils/emi";

// Registers an EMI that already exists on a Credit Card — e.g. one set up
// before the user started using Forge — without creating a fake historical
// purchase transaction. This is a separate flow from EmiConvertForm (which
// converts a real Expense transaction into an EMI); the two never overlap.
//
// "Outstanding Principal" here is the amount still owed on the EMI TODAY,
// not an original purchase amount, and "Monthly EMI" / "Interest Rate" are
// entered directly (the user already knows what they're paying) rather than
// derived the way EmiConvertForm derives them from principal + tenure.
// Registering this never creates a transaction and never changes the card's
// outstanding or available limit — see addManualEmiPlan in App.jsx.
export function AddEmiPlanForm({ onDone }) {
  const { data, theme, addManualEmiPlan } = useApp();
  const creditCards = data.accounts.filter((a) => a.type === "Credit Card");

  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(creditCards[0]?.id || "");
  const [principal, setPrincipal] = useState("");
  const [emiAmount, setEmiAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(todayISO());
  const [error, setError] = useState("");

  const totals = useMemo(
    () => computeManualEmiTotals(principal, emiAmount, tenureMonths),
    [principal, emiAmount, tenureMonths]
  );

  const submit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Give this EMI a name, e.g. \u201cHDFC EMI 1\u201d.");
      return;
    }
    if (!accountId) {
      setError("Select the Credit Card this EMI is on.");
      return;
    }
    const account = creditCards.find((a) => a.id === accountId);
    if (!account) {
      setError("Select a valid Credit Card account.");
      return;
    }
    const p = Number(principal);
    if (principal === "" || Number.isNaN(p) || !Number.isFinite(p) || p <= 0) {
      setError("Outstanding principal must be greater than 0.");
      return;
    }
    const emi = Number(emiAmount);
    if (emiAmount === "" || Number.isNaN(emi) || !Number.isFinite(emi) || emi <= 0) {
      setError("Monthly EMI must be greater than 0.");
      return;
    }
    const rate = Number(interestRate);
    if (interestRate === "" || Number.isNaN(rate) || !Number.isFinite(rate) || rate < 0) {
      setError("Interest rate can't be negative.");
      return;
    }
    const tenure = Number(tenureMonths);
    if (!Number.isInteger(tenure) || tenure <= 0) {
      setError("Remaining months must be a whole number greater than 0.");
      return;
    }
    if (!firstDueDate) {
      setError("First due date is required.");
      return;
    }
    setError("");

    addManualEmiPlan({
      accountId,
      name: name.trim(),
      principal: p,
      interestRate: rate,
      tenureMonths: tenure,
      emiAmount: emi,
      totalInterest: totals.totalInterest,
      totalPayable: totals.totalPayable,
      firstDueDate,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="EMI Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HDFC EMI 1" required />
      </Field>

      <Field label="Credit Card">
        {creditCards.length === 0 ? (
          <p className={`type-secondary ${theme.subtext}`}>Add a Credit Card account first to register an EMI on it.</p>
        ) : (
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {creditCards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        )}
      </Field>

      <Field label="Outstanding Principal (₹)">
        <TextInput type="number" min="0.01" step="0.01" placeholder="0.00" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly EMI (₹)">
          <TextInput type="number" min="0.01" step="0.01" placeholder="0.00" value={emiAmount} onChange={(e) => setEmiAmount(e.target.value)} required />
        </Field>
        <Field label="Interest Rate (% p.a.)">
          <TextInput type="number" min="0" step="0.01" placeholder="e.g. 17" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Remaining Months">
          <TextInput type="number" min="1" step="1" placeholder="e.g. 4" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} required />
        </Field>
        <Field label="First Due Date">
          <DatePicker value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} required />
        </Field>
      </div>

      {emiAmount && tenureMonths && (
        <div className={`rounded-[14px] border p-4 space-y-2 ${theme.border} bg-white/[0.02]`}>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Total Payable (remaining)</span>
            <span className="type-body font-semibold">{fmt(totals.totalPayable)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`type-secondary ${theme.subtext}`}>Total Interest (remaining)</span>
            <span className="type-body font-semibold">{fmt(totals.totalInterest)}</span>
          </div>
          {!totals.coversPrincipal && (
            <p className="type-secondary text-amber-400">
              Heads up: {tenureMonths} × {fmt(Number(emiAmount) || 0)} comes to less than the outstanding principal you entered. That's fine if you're not sure of the exact numbers, but worth double-checking.
            </p>
          )}
        </div>
      )}

      <p className={`type-secondary ${theme.subtext}`}>
        This EMI is already included in {creditCards.find((a) => a.id === accountId)?.name || "the card"}'s outstanding balance — adding it here won't change that balance or the card's available limit. It just sets up the installment schedule so you can track and pay it going forward.
      </p>

      {error && <p className="type-secondary text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <GhostButton type="button" className="flex-1 justify-center" onClick={onDone}>Cancel</GhostButton>
        <PrimaryButton type="submit" className="flex-1 justify-center" disabled={creditCards.length === 0}>Add EMI Plan</PrimaryButton>
      </div>
    </form>
  );
}
