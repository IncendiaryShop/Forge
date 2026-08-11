import { uid } from "./helpers";

/* ------------------------------ seed data ------------------------------ */

export function seedData() {
  const accounts = [
    { id: "acc-bank", name: "HDFC Bank", type: "Bank", opening: 42000 },
    { id: "acc-cash", name: "Cash", type: "Cash", opening: 3200 },
    { id: "acc-cc", name: "Credit Card", type: "Credit Card", opening: 0 },
  ];

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const txns = [];
  const pushTxn = (daysAgo, type, category, description, account, amount) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    txns.push({
      id: uid(), date: d.toISOString().slice(0, 10), type, category, description,
      account, transferAccount: "", amount: Math.abs(amount),
    });
  };

  pushTxn(1, "Expense", "Food", "Dinner with friends", "acc-cc", 850);
  pushTxn(2, "Expense", "Groceries", "Weekly groceries", "acc-bank", 2400);
  pushTxn(3, "Expense", "Transportation", "Cab rides", "acc-cash", 320);
  pushTxn(4, "Income", "Freelance", "UI project payment", "acc-bank", 12000);
  pushTxn(5, "Expense", "Subscriptions", "Netflix", "acc-cc", 649);
  pushTxn(6, "Expense", "Utilities", "Electricity bill", "acc-bank", 2200);
  pushTxn(8, "Expense", "Shopping", "New shoes", "acc-cc", 3200);
  pushTxn(9, "Expense", "Entertainment", "Movie night", "acc-cash", 600);
  pushTxn(11, "Expense", "Food", "Groceries + snacks", "acc-bank", 1450);
  pushTxn(14, "Income", "Salary", "Monthly salary", "acc-bank", 65000);
  pushTxn(15, "Expense", "Rent", "House rent", "acc-bank", 15000);
  pushTxn(18, "Expense", "Fuel", "Petrol", "acc-cash", 1200);
  pushTxn(20, "Expense", "Medical", "Pharmacy", "acc-bank", 540);
  pushTxn(22, "Expense", "Shopping", "Home essentials", "acc-cc", 1800);
  pushTxn(35, "Income", "Salary", "Monthly salary", "acc-bank", 65000);
  pushTxn(33, "Expense", "Rent", "House rent", "acc-bank", 15000);
  pushTxn(40, "Expense", "Food", "Takeout", "acc-cc", 980);
  pushTxn(44, "Expense", "Groceries", "Monthly groceries", "acc-bank", 5200);
  pushTxn(48, "Expense", "Travel", "Weekend trip", "acc-cc", 4500);
  pushTxn(52, "Income", "Cashback", "Card cashback", "acc-bank", 320);
  pushTxn(60, "Expense", "Entertainment", "Concert tickets", "acc-cc", 2200);
  pushTxn(63, "Income", "Salary", "Monthly salary", "acc-bank", 63000);
  pushTxn(65, "Expense", "Utilities", "Internet + mobile", "acc-bank", 1500);
  pushTxn(70, "Expense", "Insurance", "Health insurance premium", "acc-bank", 3400);
  pushTxn(75, "Expense", "Education", "Online course", "acc-cc", 1999);

  const budgets = { Food: 6000, Groceries: 7000, Transportation: 3000, Shopping: 4000, Entertainment: 2500, Utilities: 4500, Fuel: 2000 };

  // Matching income transaction for the seeded "Paid" invoice below (INV-2026-008),
  // so account balances and dashboard totals stay consistent with its Paid status.
  const paidInvoiceTxnId = uid();
  const paidInvoicePaymentDate = new Date(new Date(now).setDate(now.getDate() - 12)).toISOString().slice(0, 10);
  txns.push({
    id: paidInvoiceTxnId,
    date: paidInvoicePaymentDate,
    type: "Income",
    category: "Freelance",
    description: "Invoice INV-2026-008 - Fiverr Client — incendiaryshop",
    account: "acc-bank",
    transferAccount: "",
    amount: 9000,
    createdAt: new Date().toISOString(),
  });


  const bills = [
  {
    id: uid(),
    name: "Netflix",
    category: "Subscriptions",
    amount: 649,
    dueDay: 5,
    recurring: true,
    paidCycle: null,
    paidTransactionId: null,
  },
  {
    id: uid(),
    name: "House Rent",
    category: "Rent",
    amount: 15000,
    dueDay: 1,
    recurring: true,
    paidCycle: null,
    paidTransactionId: null,
  },
  {
    id: uid(),
    name: "Electricity",
    category: "Utilities",
    amount: 2200,
    dueDay: 10,
    recurring: true,
    paidCycle: null,
    paidTransactionId: null,
  },
  {
    id: uid(),
    name: "Spotify",
    category: "Subscriptions",
    amount: 119,
    dueDay: 18,
    recurring: true,
    paidCycle: null,
    paidTransactionId: null,
  },
  {
    id: uid(),
    name: "Health Insurance",
    category: "Insurance",
    amount: 3400,
    dueDay: 25,
    recurring: true,
    paidCycle: null,
    paidTransactionId: null,
  },
];

  const goals = [
    { id: uid(), name: "Emergency Fund", target: 100000, current: 42000, deadline: "2026-12-31" },
    { id: uid(), name: "Goa Trip", target: 30000, current: 12500, deadline: "2026-10-01" },
    { id: uid(), name: "New Laptop", target: 80000, current: 18000, deadline: "2027-02-01" },
  ];

  const invoices = [
    {
      id: uid(),
      invoiceNumber: "INV-2026-014",
      client: "IntervueBox",
      invoiceDate: new Date(new Date(now).setDate(now.getDate() - 3)).toISOString().slice(0, 10),
      amount: 28000,
      status: "Unpaid",
      paymentDate: null,
      paymentAccountId: null,
      transactionId: null,
    },
    {
      id: uid(),
      invoiceNumber: "INV-2026-011",
      client: "Suburbia Esports",
      invoiceDate: new Date(new Date(now).setDate(now.getDate() - 25)).toISOString().slice(0, 10),
      amount: 12500,
      status: "Unpaid",
      paymentDate: null,
      paymentAccountId: null,
      transactionId: null,
    },
    {
      id: uid(),
      invoiceNumber: "INV-2026-008",
      client: "Fiverr Client — incendiaryshop",
      invoiceDate: new Date(new Date(now).setDate(now.getDate() - 18)).toISOString().slice(0, 10),
      amount: 9000,
      status: "Paid",
      paymentDate: paidInvoicePaymentDate,
      paymentAccountId: "acc-bank",
      transactionId: paidInvoiceTxnId,
    },
  ];

  return { accounts, transactions: txns, budgets, bills, goals, invoices, settings: { dark: false } };
}