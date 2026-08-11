import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, Select, PrimaryButton } from "../components";
import { EXPENSE_CATEGORIES } from "../utils/constants";

export function BudgetForm({ onDone, category, currentAmount }) {
  const { setBudget } = useApp();
  const [cat, setCat] = useState(category || EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState(currentAmount || "");
  const submit = (e) => {
    e.preventDefault();
    if (!amount) return;
    setBudget(cat, Number(amount));
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Category">
        <Select value={cat} onChange={(e) => setCat(e.target.value)} disabled={!!category}>
          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Monthly Budget (₹)">
        <TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <PrimaryButton type="submit" className="w-full justify-center mt-2">Save Budget</PrimaryButton>
    </form>
  );
}
