

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
