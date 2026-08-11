import { supabase } from "../lib/supabase";
import { call } from "./errors";

// DB (snake_case) <-> app model (camelCase, matches the pre-Supabase shape
// exactly so AppContext/pages/forms don't need to change).
const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  provider: r.provider || "",
  opening: Number(r.opening),
});

const toRow = (a) => ({
  name: a.name,
  type: a.type,
  provider: a.provider || null,
  opening: Number(a.opening) || 0,
});

export async function listAccounts() {
  const { data, error } = await call(
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    "Couldn't load accounts."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createAccount(userId, account) {
  const { data, error } = await call(
    supabase.from("accounts").insert({ ...toRow(account), user_id: userId }).select().single(),
    "Couldn't create the account."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateAccount(id, patch) {
  const { data, error } = await call(
    supabase.from("accounts").update(toRow({ ...patch })).eq("id", id).select().single(),
    "Couldn't save the account."
  );
  return { data: data ? fromRow(data) : null, error };
}

// Deleting an account that's referenced by any transaction is rejected by the
// database (transactions.account_id / transfer_account_id use ON DELETE
// RESTRICT) — this mirrors the existing client-side guard in AccountsPage,
// now enforced at the DB level too. Postgres error code 23503 maps to a
// friendly "linked to other data" message via services/errors.js.
export async function deleteAccount(id) {
  const { error } = await call(
    supabase.from("accounts").delete().eq("id", id),
    "This account has transactions linked to it and can't be deleted."
  );
  return { error };
}
