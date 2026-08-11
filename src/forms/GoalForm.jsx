import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Field, TextInput, PrimaryButton } from "../components";

export function GoalForm({ onDone, existing }) {
  const { addGoal, updateGoal } = useApp();
  const [form, setForm] = useState(existing || { name: "", target: "", current: "", deadline: "" });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.target) return;
    const payload = { ...form, target: Number(form.target), current: Number(form.current) || 0 };
    if (existing) updateGoal(existing.id, payload); else addGoal(payload);
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Goal Name">
        <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emergency Fund" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target (₹)">
          <TextInput type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
        </Field>
        <Field label="Current Saved (₹)">
          <TextInput type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
        </Field>
      </div>
      <Field label="Deadline">
        <TextInput type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
      </Field>
      <PrimaryButton type="submit" className="w-full justify-center mt-2">{existing ? "Save Changes" : "Add Goal"}</PrimaryButton>
    </form>
  );
}
