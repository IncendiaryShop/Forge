import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, Select, PrimaryButton, AccountLogo } from "../components";
import { ACCOUNT_TYPES } from "../utils/constants";
import { BANKS, getBank } from "../utils/bankRegistry";
import { calculateEmi } from "../utils/emi";

function bankShortName(name) {
  return name.replace(/\s+Bank$/, "");
}

function generateAccountName(type, provider) {
  if (type === "Cash") return "Cash";
  const bankName = getBank(provider)?.name || "Account";
  if (type === "Credit Card") return `${bankShortName(bankName)} Credit Card`;
  if (type === "Loan") return `${bankShortName(bankName)} Loan`;
  return bankName;
}

export function AccountForm({ onDone, existing }) {
  const { addAccount, updateAccount, data } = useApp();
  const [form, setForm] = useState(existing || { name: "", type: ACCOUNT_TYPES[0], opening: "", provider: "other", creditLimit: "", statementDate: "", paymentDueDate: "", loanInterestRate: "", loanTenureMonths: "", loanEmiAmount: "", loanStartDate: "" });
  const [error, setError] = useState("");
  const isCreditCard = form.type === "Credit Card";
  const isLoan = form.type === "Loan";
  const hasTransactions = existing
  ? data?.transactions?.some(
      (t) => t.account === existing.id || t.transferAccount === existing.id
    )
  : false;
  const hasLoanSchedule = existing
    ? data?.loanInstallments?.some((i) => i.accountId === existing.id)
    : false;

const openingOutstandingLocked = isCreditCard && !!existing && hasTransactions;
// Once a loan has been disbursed, its terms are locked — the generated
// schedule already reflects the original principal/rate/tenure/start date,
// and silently changing them would leave the schedule inconsistent with
// what's on the account. Safe fields (EMI display, provider/name via type
// change) aren't part of this lock; only the amortization inputs are.
const loanTermsLocked = isLoan && !!existing && hasLoanSchedule;

  const suggestedEmi = isLoan && form.opening && form.loanTenureMonths
    ? calculateEmi(Number(form.opening) || 0, Number(form.loanInterestRate) || 0, Number(form.loanTenureMonths) || 0).emiAmount
    : 0;

  const submit = (e) => {
    e.preventDefault();
    const resolvedProvider = form.type === "Cash" ? null : (form.provider || "other");
    const typeOrProviderChanged = !existing || existing.type !== form.type || (existing.provider || null) !== resolvedProvider;
    const name = typeOrProviderChanged ? generateAccountName(form.type, resolvedProvider) : existing.name;

    if (isCreditCard) {
      const limit = Number(form.creditLimit);
      if (form.creditLimit === "" || form.creditLimit === null || Number.isNaN(limit) || limit <= 0) {
        setError("Credit limit must be greater than 0.");
        return;
      }
      if (form.statementDate !== "" && form.statementDate != null) {
        const sd = Number(form.statementDate);
        if (!Number.isInteger(sd) || sd < 1 || sd > 31) {
          setError("Statement date must be a day of the month between 1 and 31.");
          return;
        }
      }
      if (form.paymentDueDate !== "" && form.paymentDueDate != null) {
        const dd = Number(form.paymentDueDate);
        if (!Number.isInteger(dd) || dd < 1 || dd > 31) {
          setError("Payment due date must be a day of the month between 1 and 31.");
          return;
        }
      }
    }

    if (isLoan) {
      const principal = Number(form.opening);
      if (!form.opening || Number.isNaN(principal) || principal <= 0) {
        setError("Original principal must be greater than 0.");
        return;
      }
      const rate = Number(form.loanInterestRate);
      if (form.loanInterestRate === "" || Number.isNaN(rate) || rate < 0) {
        setError("Interest rate can't be negative.");
        return;
      }
      const tenure = Number(form.loanTenureMonths);
      if (!Number.isInteger(tenure) || tenure <= 0) {
        setError("Tenure must be a whole number of months greater than 0.");
        return;
      }
      const emi = Number(form.loanEmiAmount) || suggestedEmi;
      if (!emi || emi <= 0) {
        setError("EMI amount must be greater than 0.");
        return;
      }
      if (!form.loanStartDate) {
        setError("Start date is required.");
        return;
      }
    }
    setError("");

    const payload = {
      ...form,
      name,
      opening: openingOutstandingLocked || loanTermsLocked
  ? Number(existing.opening) || 0
  : Number(form.opening) || 0,
      provider: resolvedProvider,
      creditLimit: isCreditCard ? Number(form.creditLimit) : null,
      statementDate: isCreditCard && form.statementDate !== "" && form.statementDate != null ? Number(form.statementDate) : null,
      paymentDueDate: isCreditCard && form.paymentDueDate !== "" && form.paymentDueDate != null ? Number(form.paymentDueDate) : null,
      loanInterestRate: isLoan ? (loanTermsLocked ? existing.loanInterestRate : Number(form.loanInterestRate)) : null,
      loanTenureMonths: isLoan ? (loanTermsLocked ? existing.loanTenureMonths : Number(form.loanTenureMonths)) : null,
      loanEmiAmount: isLoan ? Number(form.loanEmiAmount) || suggestedEmi : null,
      loanStartDate: isLoan ? (loanTermsLocked ? existing.loanStartDate : form.loanStartDate) : null,
      loanStatus: isLoan ? (existing?.loanStatus || "Active") : null,
    };
    if (existing) updateAccount(existing.id, payload); else addAccount(payload);
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Account Type">
        <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
      </Field>
      {form.type !== "Cash" && (
        <Field label={isLoan ? "Lender" : "Bank / Provider"}>
          <div className="flex items-center gap-3">
            <AccountLogo account={form} size="sm" />
            <div className="flex-1">
              <Select value={form.provider || "other"} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                {BANKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          </div>
        </Field>
      )}
      <Field label={isCreditCard ? "Opening Outstanding (₹)" : isLoan ? "Original Principal (₹)" : "Balance (₹)"}>
  <input
    type="number"
    value={form.opening}
    onChange={(e) => setForm({ ...form, opening: e.target.value })}
    placeholder="0"
    disabled={openingOutstandingLocked || loanTermsLocked}
    className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${
      openingOutstandingLocked || loanTermsLocked ? "opacity-50 cursor-not-allowed" : ""
    }`}
  />

  {openingOutstandingLocked && (
    <p className="text-xs text-white/45 mt-2">
      Opening outstanding can't be changed after transactions have been recorded.
    </p>
  )}
  {loanTermsLocked && (
    <p className="text-xs text-white/45 mt-2">
      Loan terms can't be changed after the loan has been disbursed.
    </p>
  )}
</Field>
      {isCreditCard && (
        <Field label="Credit Limit (₹)">
          <input type="number" min="0.01" step="0.01" value={form.creditLimit ?? ""} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="e.g. 100000"
            className="forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none" required />
        </Field>
      )}
      {isCreditCard && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statement Date">
            <input type="number" min="1" max="31" step="1" value={form.statementDate ?? ""} onChange={(e) => setForm({ ...form, statementDate: e.target.value })} placeholder="e.g. 10"
              className="forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none" />
          </Field>
          <Field label="Payment Due Date">
            <input type="number" min="1" max="31" step="1" value={form.paymentDueDate ?? ""} onChange={(e) => setForm({ ...form, paymentDueDate: e.target.value })} placeholder="e.g. 28"
              className="forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none" />
          </Field>
        </div>
      )}
      {isLoan && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interest Rate (% p.a.)">
              <input type="number" min="0" step="0.01" value={form.loanInterestRate ?? ""} onChange={(e) => setForm({ ...form, loanInterestRate: e.target.value })} placeholder="e.g. 9.5"
                disabled={loanTermsLocked}
                className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${loanTermsLocked ? "opacity-50 cursor-not-allowed" : ""}`} />
            </Field>
            <Field label="Tenure (months)">
              <input type="number" min="1" step="1" value={form.loanTenureMonths ?? ""} onChange={(e) => setForm({ ...form, loanTenureMonths: e.target.value })} placeholder="e.g. 60"
                disabled={loanTermsLocked}
                className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${loanTermsLocked ? "opacity-50 cursor-not-allowed" : ""}`} />
            </Field>
          </div>
          <Field label="EMI Amount (₹)">
            <input type="number" min="0.01" step="0.01" value={form.loanEmiAmount || (suggestedEmi ? String(suggestedEmi) : "")} onChange={(e) => setForm({ ...form, loanEmiAmount: e.target.value })}
              placeholder={suggestedEmi ? String(suggestedEmi) : "e.g. 12000"}
              className="forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none" />
          </Field>
          <Field label="Start Date">
            <input type="date" value={form.loanStartDate ?? ""} onChange={(e) => setForm({ ...form, loanStartDate: e.target.value })}
              disabled={loanTermsLocked}
              className={`forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none ${loanTermsLocked ? "opacity-50 cursor-not-allowed" : ""}`} />
          </Field>
        </>
      )}
      {error && <p className="type-secondary text-red-500">{error}</p>}
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Account"}</PrimaryButton>
    </form>
  );
}