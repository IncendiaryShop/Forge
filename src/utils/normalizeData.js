// Defensively fills in any top-level fields missing from malformed or legacy
// data (old localStorage saves, or partially-read cloud state) so the app can
// never crash on load — each field falls back to an empty collection rather
// than being left undefined. Shared by App.jsx (loading local data before
// Supabase was added) and services/migration.js (reading the local copy to
// migrate it).
export function normalizeData(parsed) {
  const safe = parsed && typeof parsed === "object" ? parsed : {};
  return {
    accounts: Array.isArray(safe.accounts) ? safe.accounts : [],
    transactions: Array.isArray(safe.transactions) ? safe.transactions : [],
    budgets: safe.budgets && typeof safe.budgets === "object" ? safe.budgets : {},
    bills: Array.isArray(safe.bills) ? safe.bills : [],
    goals: Array.isArray(safe.goals) ? safe.goals : [],
    invoices: Array.isArray(safe.invoices) ? safe.invoices : [],
    settings: safe.settings && typeof safe.settings === "object" ? safe.settings : { dark: false },
  };
}
