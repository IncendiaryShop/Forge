import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, Select, PrimaryButton } from "../components";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../utils/constants";
import { todayISO, fmt } from "../utils/helpers";

export function TransactionForm({ onDone, existing }) {
  const { addTransaction, updateTransaction, data, accountOutstanding, insufficientFundsError, creditCardPaymentError } = useApp();
  // Loan accounts are never selectable here — money only ever moves in/out
  // of a Loan through the dedicated Disburse Loan / Loan Schedule "Mark
  // Paid" flows (AccountsPage.jsx / LoanSchedule.jsx), which correctly split
  // principal vs interest. A generic Expense/Income/Transfer against a Loan
  // account would bypass that split entirely.
  const selectableAccounts = data.accounts.filter((a) => a.type !== "Loan");
  const [form, setForm] = useState(existing || {
    date: todayISO(), type: "Expense", category: EXPENSE_CATEGORIES[0], description: "",
    account: selectableAccounts[0]?.id || "", transferAccount: "", amount: "",
  });
  const cats = form.type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [error, setError] = useState("");

  const destinationAccount = data.accounts.find((a) => a.id === form.transferAccount);
  const isCreditCardPayment = form.type === "Transfer" && destinationAccount?.type === "Credit Card";

  // Only Expenses against a Credit Card account are limit-checked. When
  // editing an existing Expense on the same card, its old amount is backed
  // out of the current outstanding first so the check compares against what
  // outstanding would be WITHOUT this transaction, not double-counted.
  const creditLimitError = (accountId, amount) => {
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc || acc.type !== "Credit Card") return null;
    const limit = Number(acc.creditLimit);
    if (!limit || limit <= 0) return null; // no limit set yet — nothing to enforce

    let outstanding = accountOutstanding(accountId);
    if (existing && existing.type === "Expense" && existing.account === accountId) {
      outstanding -= Number(existing.amount) || 0;
    }

    const requested = Number(amount) || 0;
    const resulting = outstanding + requested;
    if (resulting > limit) {
      const available = limit - outstanding;
      return `This would exceed ${acc.name}'s credit limit. Credit limit: ${fmt(limit)} · Current outstanding: ${fmt(outstanding)} · Available credit: ${fmt(available)} · Requested amount: ${fmt(requested)}.`;
    }
    return null;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (form.type === "Transfer") {
      if (!form.transferAccount) {
        setError("Select a destination account.");
        return;
      }
      if (form.transferAccount === form.account) {
        setError("Source and destination accounts must be different.");
        return;
      }
    }
    if (form.type === "Expense") {
      const limitError = creditLimitError(form.account, form.amount);
      if (limitError) {
        setError(limitError);
        return;
      }
      const fundsError = insufficientFundsError(form.account, form.amount, existing);
      if (fundsError) {
        setError(fundsError);
        return;
      }
    }
    if (form.type === "Transfer") {
      const fundsError = insufficientFundsError(form.account, form.amount, existing);
      if (fundsError) {
        setError(fundsError);
        return;
      }
      const cardError = creditCardPaymentError(form.transferAccount, form.amount, existing);
      if (cardError) {
        setError(cardError);
        return;
      }
    }
    setError("");
    const payload = { ...form, amount: Number(form.amount) };
    if (existing) updateTransaction(existing.id, payload);
    else addTransaction(payload);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category: e.target.value === "Income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })}>
            <option>Expense</option><option>Income</option><option>Transfer</option>
          </Select>
        </Field>
        <Field label="Date">
          <TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          {form.type === "Transfer" ? (
            <TextInput value={isCreditCardPayment ? "Credit Card Payment" : "Transfer"} disabled />
          ) : (
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Amount (₹)">
          <TextInput type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </Field>
      </div>
      <Field label="Description">
        <TextInput placeholder="e.g. Dinner with friends" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={form.type === "Transfer" ? "From Account" : "Account"}>
          <Select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
            {selectableAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        {form.type === "Transfer" && (
          <Field label="To Account">
            <Select value={form.transferAccount} onChange={(e) => setForm({ ...form, transferAccount: e.target.value })}>
              <option value="">Select account</option>
              {selectableAccounts.filter(a => a.id !== form.account).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        )}
      </div>
      {isCreditCardPayment && (
        <p className="type-secondary text-accent">
          Credit Card Payment — this will reduce {destinationAccount.name}'s outstanding balance.
        </p>
      )}
      {error && <p className="type-secondary text-red-500">{error}</p>}
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Transaction"}</PrimaryButton>
    </form>
  );
}