import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, Select, PrimaryButton, AccountLogo } from "../components";
import { ACCOUNT_TYPES } from "../utils/constants";
import { BANKS, getBank } from "../utils/bankRegistry";

function bankShortName(name) {
  return name.replace(/\s+Bank$/, "");
}

function generateAccountName(type, provider) {
  if (type === "Cash") return "Cash";
  const bankName = getBank(provider)?.name || "Account";
  if (type === "Credit Card") return `${bankShortName(bankName)} Credit Card`;
  return bankName;
}

export function AccountForm({ onDone, existing }) {
  const { addAccount, updateAccount } = useApp();
  const [form, setForm] = useState(existing || { name: "", type: ACCOUNT_TYPES[0], opening: "", provider: "other" });
  const submit = (e) => {
    e.preventDefault();
    const resolvedProvider = form.type === "Cash" ? null : (form.provider || "other");
    const typeOrProviderChanged = !existing || existing.type !== form.type || (existing.provider || null) !== resolvedProvider;
    const name = typeOrProviderChanged ? generateAccountName(form.type, resolvedProvider) : existing.name;
    const payload = { ...form, name, opening: Number(form.opening) || 0, provider: resolvedProvider };
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
        <Field label="Bank / Provider">
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
      <Field label="Balance (₹)">
        <input type="number" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} placeholder="0"
          className="forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none" />
      </Field>
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Account"}</PrimaryButton>
    </form>
  );
}