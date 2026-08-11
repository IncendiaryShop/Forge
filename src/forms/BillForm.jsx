import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, Select, PrimaryButton, ServiceLogo, AppIcon } from "../components";
import { EXPENSE_CATEGORIES } from "../utils/constants";
import { SERVICES } from "../utils/serviceRegistry";
import { BILL_TYPES, resolveBillDisplay } from "../utils/billRegistry";

const BRAND_SERVICES = SERVICES.filter((s) => s.id !== "custom");
const CUSTOM_SERVICE = SERVICES.find((s) => s.id === "custom");

export function BillForm({ onDone, existing }) {
  const { addBill, updateBill } = useApp();
  const [form, setForm] = useState(existing || { name: "", category: "Subscriptions", amount: "", dueDay: 1, recurring: true, provider: "custom" });
  const [error, setError] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);

  const preview = resolveBillDisplay(form);

  const onProviderChange = (providerId) => {
    const billType = BILL_TYPES.find((t) => t.id === providerId);
    setForm((f) => ({
      ...f,
      provider: providerId,
      category: billType && !categoryTouched ? billType.category : f.category,
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      setError("Amount must be greater than 0.");
      return;
    }
    const dueDay = Number(form.dueDay);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setError("Due day must be a whole number between 1 and 31.");
      return;
    }
    setError("");
    const payload = { ...form, name: form.name.trim(), amount, dueDay, provider: form.provider || "custom" };
    if (existing) updateBill(existing.id, payload); else addBill(payload);
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Service / Provider">
        <div className="flex items-center gap-3">
          {preview.kind === "brand" ? (
            <ServiceLogo provider={preview.providerId} />
          ) : (
            <AppIcon name={preview.icon} size="md" container />
          )}
          <Select value={form.provider || "custom"} onChange={(e) => onProviderChange(e.target.value)} className="flex-1">
            <optgroup label="Common Bills">
              {BILL_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="Services">
              {BRAND_SERVICES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Other">
              <option value={CUSTOM_SERVICE.id}>{CUSTOM_SERVICE.name}</option>
            </optgroup>
          </Select>
        </div>
      </Field>
      <Field label="Name">
        <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Netflix" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={form.category} onChange={(e) => { setCategoryTouched(true); setForm({ ...form, category: e.target.value }); }}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <TextInput type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </Field>
      </div>
      <Field label="Due Day of Month">
        <TextInput type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
      </Field>
      {error && <p className="type-secondary text-red-500">{error}</p>}
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Bill"}</PrimaryButton>
    </form>
  );
}