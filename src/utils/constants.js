/* ----------------------------- constants ----------------------------- */

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Bonus", "Interest", "Cashback", "Refund", "Gift", "Dividend", "Rental", "Other"];
export const EXPENSE_CATEGORIES = ["Food", "Groceries", "Transportation", "Fuel", "Rent", "Utilities", "Medical", "Insurance", "Shopping", "Travel", "Entertainment", "Education", "Subscriptions", "Family", "EMI", "Miscellaneous"];
export const ACCOUNT_TYPES = ["Bank", "Cash", "Wallet", "Credit Card", "Fixed Deposit", "Investment", "Loan"];
export const CHART_COLORS = [
  "#60269d",
"#7344b1",
"#8660c4",
"#9a7cd7",
"#af98e9",
"#c5b4fb"
];
export const STORAGE_KEY = "finance-tracker-data-v1";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard.home" },
  { id: "transactions", label: "Transactions", icon: "dashboard.recent" },
  { id: "accounts", label: "Accounts", icon: "accountTypes.bank" },
  { id: "budget", label: "Budget", icon: "dashboard.budget" },
  { id: "bills", label: "Recurring", icon: "bills.subscription" },
  { id: "invoices", label: "Invoices", icon: "dashboard.invoices" },
  { id: "goals", label: "Savings Goals", icon: "goals.savings" },
];

export const PAGE_TITLES = { dashboard: "Dashboard", transactions: "Transactions", accounts: "Accounts", budget: "Monthly Budget", bills: "Recurring", invoices: "Invoices", goals: "Savings Goals" };
