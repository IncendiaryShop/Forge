import { supabase } from "../lib/supabase";
import { call } from "./errors";

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  target: Number(r.target),
  current: Number(r.current),
  deadline: r.deadline,
});

const toRow = (g) => ({
  name: g.name,
  target: Number(g.target),
  current: g.current !== undefined ? Number(g.current) : undefined,
  deadline: g.deadline || null,
});

export async function listGoals() {
  const { data, error } = await call(
    supabase.from("goals").select("*").order("created_at", { ascending: true }),
    "Couldn't load goals."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createGoal(userId, goal) {
  const { data, error } = await call(
    supabase.from("goals").insert({ ...toRow(goal), current: Number(goal.current) || 0, user_id: userId }).select().single(),
    "Couldn't create the goal."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateGoal(id, patch) {
  const row = toRow(patch);
  if (row.current === undefined) delete row.current;
  const { data, error } = await call(
    supabase.from("goals").update(row).eq("id", id).select().single(),
    "Couldn't save the goal."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function deleteGoal(id) {
  const { error } = await call(
    supabase.from("goals").delete().eq("id", id),
    "Couldn't delete the goal."
  );
  return { error };
}

// Contribution is a straight increment on the DB side to avoid a stale-read
// race between two devices contributing at nearly the same time (increment
// happens in Postgres via the raw SQL expression, not by sending back a
// client-computed new total).
export async function contributeGoal(id, amount) {
  const { data, error } = await call(
    supabase.rpc("increment_goal", { p_goal_id: id, p_amount: Number(amount) }),
    "Couldn't save the contribution."
  );
  return { data: data ? fromRow(data) : null, error };
}
