import { supabase } from "../lib/supabase";
import { call } from "./errors";

// Current app models budgets as a flat { category: amount } dict rather than
// a list — listBudgets() reshapes the rows into that same dict so
// AppContext/BudgetPage don't need to change.
export async function listBudgets() {
  const { data, error } = await call(
    supabase.from("budgets").select("*"),
    "Couldn't load budgets."
  );
  if (error) return { data: null, error };
  const dict = {};
  data.forEach((r) => { dict[r.category] = Number(r.amount); });
  return { data: dict, error: null };
}

// Upsert on (user_id, category) — mirrors the old setBudget(cat, amount)
// which always just wrote budgets[cat] = amount regardless of whether it
// already existed.
export async function setBudget(userId, category, amount) {
  const { data, error } = await call(
    supabase.from("budgets")
      .upsert({ user_id: userId, category, amount: Number(amount) }, { onConflict: "user_id,category" })
      .select().single(),
    "Couldn't save the budget."
  );
  return { data, error };
}

export async function removeBudget(userId, category) {
  const { error } = await call(
    supabase.from("budgets").delete().eq("user_id", userId).eq("category", category),
    "Couldn't delete the budget."
  );
  return { error };
}
