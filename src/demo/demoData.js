

import { generateLoanSchedule } from "../utils/loanAmortization";

const DEMO_USER_ID = "demo-user";
export { DEMO_USER_ID };

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}
function monthsAgoOnDay(n, day) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export const ACCOUNTS = [
  {
    id: "demo-acc-hdfc",
    name: "HDFC Bank Savings",
    type: "Bank",
    provider: "hdfc",
    opening: 46000,
    creditLimit: null,
    statementDate: null,
    paymentDueDate: null,
    loanInterestRate: null,
    loanTenureMonths: null,
    loanEmiAmount: null,
    loanStartDate: null,
    loanStatus: null,
  },
  {
    id: "demo-acc-cash",
    name: "Cash Wallet",
    type: "Cash",
    provider: "",
    opening: 9000,
    creditLimit: null,
    statementDate: null,
    paymentDueDate: null,
    loanInterestRate: null,
    loanTenureMonths: null,
    loanEmiAmount: null,
    loanStartDate: null,
    loanStatus: null,
  },
  {
    id: "demo-acc-icici-cc",
    name: "ICICI Amazon Pay Card",
    type: "Credit Card",
    provider: "icici",
    opening: 6200,
    creditLimit: 200000,
    statementDate: 3,
    paymentDueDate: 22,
    loanInterestRate: null,
    loanTenureMonths: null,
    loanEmiAmount: null,
    loanStartDate: null,
    loanStatus: null,
  },
  {
    id: "demo-acc-axis-loan",
    name: "Axis Bank Car Loan",
    type: "Loan",
    provider: "axis",
    opening: 300000,
    creditLimit: null,
    statementDate: null,
    paymentDueDate: null,
    loanInterestRate: 9.5,
    loanTenureMonths: 24,
    loanEmiAmount: null,
    loanStartDate: monthsAgoOnDay(5, 5),
    loanStatus: "Active",
  },
];

const loanAccount = ACCOUNTS.find((a) => a.id === "demo-acc-axis-loan");
const RAW_LOAN_SCHEDULE = generateLoanSchedule(
  loanAccount.opening,
  loanAccount.loanInterestRate,
  loanAccount.loanTenureMonths,

  13750,
  loanAccount.loanStartDate
);
loanAccount.loanEmiAmount = 13750;

const PAID_LOAN_INSTALLMENTS = 2;

export const LOAN_INSTALLMENTS = RAW_LOAN_SCHEDULE.map((row, idx) => {
  const paid = idx < PAID_LOAN_INSTALLMENTS;
  const id = `demo-loan-inst-${row.installmentNumber}`;
  return {
    id,
    accountId: loanAccount.id,
    installmentNumber: row.installmentNumber,
    dueDate: toISO(row.dueDate),
    emiAmount: row.emiAmount,
    principalComponent: row.principalComponent,
    interestComponent: row.interestComponent,
    status: paid ? "Paid" : "Upcoming",
    paidDate: paid ? toISO(row.dueDate) : null,
    principalTransactionId: paid ? `demo-txn-loan-principal-${row.installmentNumber}` : null,
    interestTransactionId: paid && row.interestComponent > 0 ? `demo-txn-loan-interest-${row.installmentNumber}` : null,
  };
});

const EMI_PRINCIPAL = 54000;
const EMI_TENURE = 6;
const EMI_START = monthsAgoOnDay(2, 12);
const EMI_SCHEDULE = generateLoanSchedule(EMI_PRINCIPAL, 0, EMI_TENURE, Math.round(EMI_PRINCIPAL / EMI_TENURE), EMI_START);
const EMI_PAID_COUNT = 2;

export const EMI_PLANS = [
  {
    id: "demo-emi-plan-1",
    transactionId: "demo-txn-laptop-purchase",
    accountId: "demo-acc-icici-cc",
    name: null,
    source: null,
    principal: EMI_PRINCIPAL,
    interestRate: 0,
    tenureMonths: EMI_TENURE,
    emiAmount: Math.round(EMI_PRINCIPAL / EMI_TENURE),
    totalInterest: 0,
    totalPayable: EMI_PRINCIPAL,
    startDate: EMI_START,
    status: "Active",
    createdAt: EMI_START,
  },
];

export const EMI_INSTALLMENTS = EMI_SCHEDULE.map((row, idx) => {
  const paid = idx < EMI_PAID_COUNT;
  return {
    id: `demo-emi-inst-${row.installmentNumber}`,
    emiPlanId: "demo-emi-plan-1",
    installmentNumber: row.installmentNumber,
    dueDate: toISO(row.dueDate),
    amount: row.emiAmount,
    status: paid ? "Paid" : "Upcoming",
    paidDate: paid ? toISO(row.dueDate) : null,
    paymentTransactionId: paid ? `demo-txn-emi-pay-${row.installmentNumber}` : null,
    settledViaPreclosure: false,
  };
});

const t = (id, date, type, category, description, account, amount, extra = {}) => ({
  id,
  date,
  type,
  category,
  description,
  account,
  transferAccount: extra.transferAccount || "",
  amount,
  billId: extra.billId,
  invoiceId: extra.invoiceId,
  createdAt: `${date}T09:00:00.000Z`,
});

const HDFC = "demo-acc-hdfc";
const CASH = "demo-acc-cash";
const CC = "demo-acc-icici-cc";
const LOAN = "demo-acc-axis-loan";

export const TRANSACTIONS = [

  t("demo-txn-sal-0", monthsAgoOnDay(0, 1), "Income", "Salary", "Monthly salary", HDFC, 95000),
  t("demo-txn-sal-1", monthsAgoOnDay(1, 1), "Income", "Salary", "Monthly salary", HDFC, 95000),
  t("demo-txn-sal-2", monthsAgoOnDay(2, 1), "Income", "Salary", "Monthly salary", HDFC, 92000),

  t("demo-txn-freelance-1", daysAgo(9), "Income", "Freelance", "Logo design project", HDFC, 12000),
  t("demo-txn-freelance-2", daysAgo(38), "Income", "Freelance", "Landing page build", HDFC, 8500),

  t("demo-txn-rent-0", monthsAgoOnDay(0, 5), "Expense", "Rent", "House rent", HDFC, 18000, { billId: "demo-bill-rent" }),
  t("demo-txn-rent-1", monthsAgoOnDay(1, 5), "Expense", "Rent", "House rent", HDFC, 18000),

  t("demo-txn-groc-1", daysAgo(2), "Expense", "Groceries", "BigBasket order", HDFC, 2850),
  t("demo-txn-groc-2", daysAgo(11), "Expense", "Groceries", "Weekly groceries", HDFC, 3120),
  t("demo-txn-groc-3", daysAgo(19), "Expense", "Groceries", "Weekly groceries", CASH, 1450),
  t("demo-txn-groc-4", daysAgo(27), "Expense", "Groceries", "Monthly stock-up", HDFC, 4300),

  t("demo-txn-food-1", daysAgo(1), "Expense", "Food", "Swiggy dinner", CC, 640),
  t("demo-txn-food-2", daysAgo(6), "Expense", "Food", "Coffee with friends", CASH, 380),
  t("demo-txn-food-3", daysAgo(14), "Expense", "Food", "Weekend brunch", CC, 1650),

  t("demo-txn-fuel-1", daysAgo(4), "Expense", "Fuel", "Petrol top-up", CASH, 2000),
  t("demo-txn-fuel-2", daysAgo(24), "Expense", "Fuel", "Petrol top-up", CASH, 1800),
  t("demo-txn-transport-1", daysAgo(8), "Expense", "Transportation", "Auto rides", CASH, 340),

  t("demo-txn-electricity-0", monthsAgoOnDay(0, 8), "Expense", "Utilities", "Electricity bill", HDFC, 2150, { billId: "demo-bill-electricity" }),
  t("demo-txn-electricity-1", monthsAgoOnDay(1, 8), "Expense", "Utilities", "Electricity bill", HDFC, 1980),

  t("demo-txn-netflix-0", monthsAgoOnDay(0, 15), "Expense", "Subscriptions", "Netflix", CC, 649, { billId: "demo-bill-netflix" }),
  t("demo-txn-spotify-1", daysAgo(20), "Expense", "Subscriptions", "Spotify Premium", CC, 149),

  t("demo-txn-laptop-purchase", EMI_START, "Expense", "Shopping", "New laptop (converted to EMI)", CC, EMI_PRINCIPAL),
  t("demo-txn-shopping-1", daysAgo(16), "Expense", "Shopping", "Clothing haul", CC, 3200),

  t("demo-txn-ent-1", daysAgo(5), "Expense", "Entertainment", "Movie night", CC, 900),

  t("demo-txn-health-1", daysAgo(30), "Expense", "Medical", "Pharmacy", CASH, 560),

  t("demo-txn-loan-interest-1", LOAN_INSTALLMENTS[0].paidDate, "Expense", "EMI", "Car loan EMI — interest", HDFC, LOAN_INSTALLMENTS[0].interestComponent),
  t("demo-txn-loan-principal-1", LOAN_INSTALLMENTS[0].paidDate, "Transfer", "EMI", "Car loan EMI — principal", HDFC, LOAN_INSTALLMENTS[0].principalComponent, { transferAccount: LOAN }),
  t("demo-txn-loan-interest-2", LOAN_INSTALLMENTS[1].paidDate, "Expense", "EMI", "Car loan EMI — interest", HDFC, LOAN_INSTALLMENTS[1].interestComponent),
  t("demo-txn-loan-principal-2", LOAN_INSTALLMENTS[1].paidDate, "Transfer", "EMI", "Car loan EMI — principal", HDFC, LOAN_INSTALLMENTS[1].principalComponent, { transferAccount: LOAN }),

  t("demo-txn-loan-disbursement", loanAccount.loanStartDate, "Transfer", "Other", "Car loan disbursed", LOAN, loanAccount.opening, { transferAccount: HDFC }),

  t("demo-txn-emi-pay-1", EMI_INSTALLMENTS[0].paidDate, "Transfer", "EMI", "Laptop EMI installment 1/6", HDFC, EMI_INSTALLMENTS[0].amount, { transferAccount: CC }),
  t("demo-txn-emi-pay-2", EMI_INSTALLMENTS[1].paidDate, "Transfer", "EMI", "Laptop EMI installment 2/6", HDFC, EMI_INSTALLMENTS[1].amount, { transferAccount: CC }),

  t("demo-txn-invoice-1", daysAgo(9), "Income", "Freelance", "Invoice INV-1042 payment", HDFC, 22000, { invoiceId: "demo-invoice-1" }),
];

export const BILLS = [
  {
    id: "demo-bill-rent",
    name: "House Rent",
    category: "Rent",
    amount: 18000,
    dueDay: 5,
    recurring: true,
    provider: "rent",
    account: HDFC,
    paidCycle: monthsAgoOnDay(0, 1).slice(0, 7),
    paidTransactionId: "demo-txn-rent-0",
  },
  {
    id: "demo-bill-electricity",
    name: "Electricity",
    category: "Utilities",
    amount: 2150,
    dueDay: 8,
    recurring: true,
    provider: "electricity",
    account: HDFC,
    paidCycle: monthsAgoOnDay(0, 1).slice(0, 7),
    paidTransactionId: "demo-txn-electricity-0",
  },
  {
    id: "demo-bill-netflix",
    name: "Netflix",
    category: "Subscriptions",
    amount: 649,
    dueDay: 15,
    recurring: true,
    provider: "netflix",
    account: CC,
    paidCycle: monthsAgoOnDay(0, 1).slice(0, 7),
    paidTransactionId: "demo-txn-netflix-0",
  },
  {
    id: "demo-bill-water",
    name: "Water Bill",
    category: "Utilities",
    amount: 480,
    dueDay: 26,
    recurring: true,
    provider: "water",
    account: HDFC,
    paidCycle: null,
    paidTransactionId: null,
  },
  {
    id: "demo-bill-mobile",
    name: "Mobile Recharge",
    category: "Utilities",
    amount: 599,
    dueDay: 20,
    recurring: true,
    provider: "mobile",
    account: CC,
    paidCycle: null,
    paidTransactionId: null,
  },
];

export const BUDGETS = {
  Groceries: 12000,
  Food: 6000,
  Shopping: 8000,
  Transportation: 3500,
  Entertainment: 2500,
};

export const INVOICES = [
  {
    id: "demo-invoice-1",
    invoiceNumber: "INV-1042",
    client: "Northwind Studio",
    invoiceDate: daysAgo(14),
    amount: 22000,
    status: "Paid",
    paymentDate: daysAgo(9),
    paymentAccountId: HDFC,
    transactionId: "demo-txn-invoice-1",
  },
  {
    id: "demo-invoice-2",
    invoiceNumber: "INV-1043",
    client: "Bluepeak Media",
    invoiceDate: daysAgo(3),
    amount: 15000,
    status: "Unpaid",
    paymentDate: null,
    paymentAccountId: null,
    transactionId: null,
  },
];

export const GOALS = [
  {
    id: "demo-goal-emergency",
    name: "Emergency Fund",
    target: 150000,
    current: 62000,
    deadline: monthsAgoOnDay(-8, 1),
  },
  {
    id: "demo-goal-trip",
    name: "Goa Trip",
    target: 40000,
    current: 14000,
    deadline: monthsAgoOnDay(-3, 1),
  },
];

export const CREDIT_CARD_STATEMENTS = [];

export function createDemoSeed() {
  return {
    accounts: ACCOUNTS.map((a) => ({ ...a })),
    transactions: TRANSACTIONS.map((x) => ({ ...x })),
    budgets: { ...BUDGETS },
    bills: BILLS.map((b) => ({ ...b })),
    invoices: INVOICES.map((i) => ({ ...i })),
    goals: GOALS.map((g) => ({ ...g })),
    emiPlans: EMI_PLANS.map((p) => ({ ...p })),
    emiInstallments: EMI_INSTALLMENTS.map((x) => ({ ...x })),
    creditCardStatements: CREDIT_CARD_STATEMENTS.map((x) => ({ ...x })),
    loanInstallments: LOAN_INSTALLMENTS.map((x) => ({ ...x })),
    clients: [],
  };
}
