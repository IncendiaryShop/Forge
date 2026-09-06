import { supabase } from "../lib/supabase";
import { call } from "./errors";

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  contact: r.contact || "",
  address: r.address || "",
  city: r.city || "",
  state: r.state || "",
  postalCode: r.postal_code || "",
  country: r.country || "",
  email: r.email || "",
  phone: r.phone || "",
  tax: r.tax || "",
});

const toRow = (c) => ({
  name: c.name,
  contact: c.contact || null,
  address: c.address || null,
  city: c.city || null,
  state: c.state || null,
  postal_code: c.postalCode || null,
  country: c.country || null,
  email: c.email || null,
  phone: c.phone || null,
  tax: c.tax || null,
});

export async function listClients() {
  const { data, error } = await call(
    supabase.from("clients").select("*").order("created_at", { ascending: true }),
    "Couldn't load saved clients."
  );
  return { data: data ? data.map(fromRow) : null, error };
}

export async function createClient(userId, client) {
  const { data, error } = await call(
    supabase.from("clients").insert({ ...toRow(client), user_id: userId }).select().single(),
    "Couldn't save this client."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function updateClient(id, client) {
  const { data, error } = await call(
    supabase.from("clients").update(toRow(client)).eq("id", id).select().single(),
    "Couldn't update this client."
  );
  return { data: data ? fromRow(data) : null, error };
}

export async function deleteClient(id) {
  const { error } = await call(supabase.from("clients").delete().eq("id", id), "Couldn't delete this client.");
  return { error };
}
