

import { createDemoSeed } from "./demoData";
import { uid } from "../utils/helpers";
import { getActiveBillingCycle } from "../utils/billCycle";
import { generateLoanSchedule } from "../utils/loanAmortization";

export const DEMO_STORAGE_KEY = "forge_demo_state_v1";

const ok = (data) => ({ data, error: null });
const err = (message) => ({ data: null, error: { message } });

const newId = (prefix) => `demo-${prefix}-${uid()}`;

const nowISO = () => new Date().toISOString();

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const seed = createDemoSeed();
      saveState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.accounts)) {
      throw new Error("Corrupt demo state");
    }
    return parsed;
  } catch {

    const seed = createDemoSeed();
    saveState(seed);
    return seed;
  }
}

function saveState(state) {
  try {
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    void err;
  }
}

export function resetDemo() {
  try {
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
  } catch (err) {
    void err;
  }
}

function normalizeAccount(a) {
  const isCC = a.type === "Credit Card";
  const isLoan = a.type === "Loan";
  return {
    name: a.name,
    type: a.type,
    provider: a.provider || "",
    opening: Number(a.opening) || 0,
    creditLimit: isCC && a.creditLimit != null && a.creditLimit !== "" ? Number(a.creditLimit) : null,
    statementDate: isCC && a.statementDate != null && a.statementDate !== "" ? Number(a.statementDate) : null,
    paymentDueDate: isCC && a.paymentDueDate != null && a.paymentDueDate !== "" ? Number(a.paymentDueDate) : null,
    loanInterestRate: isLoan && a.loanInterestRate != null && a.loanInterestRate !== "" ? Number(a.loanInterestRate) : null,
    loanTenureMonths: isLoan && a.loanTenureMonths != null && a.loanTenureMonths !== "" ? Number(a.loanTenureMonths) : null,
    loanEmiAmount: isLoan && a.loanEmiAmount != null && a.loanEmiAmount !== "" ? Number(a.loanEmiAmount) : null,
    loanStartDate: isLoan && a.loanStartDate ? a.loanStartDate : null,
    loanStatus: isLoan ? a.loanStatus || "Active" : null,
  };
}

export async function listAccounts() {
  return ok(loadState().accounts);
}

export async function createAccount(userId, account) {
  const state = loadState();
  const row = { id: newId("acc"), ...normalizeAccount(account) };
  state.accounts.push(row);
  saveState(state);
  return ok(row);
}

export async function updateAccount(id, patch) {
  const state = loadState();
  const idx = state.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return err("Couldn't find this account.");
  const merged = { ...state.accounts[idx], ...normalizeAccount({ ...state.accounts[idx], ...patch }) };
  state.accounts[idx] = { ...merged, id };
  saveState(state);
  return ok(state.accounts[idx]);
}

export async function deleteAccount(id) {
  const state = loadState();
  const linked = state.transactions.some((t) => t.account === id || t.transferAccount === id);
  if (linked) return err("This account has transactions linked to it and can't be deleted.");
  state.accounts = state.accounts.filter((a) => a.id !== id);
  saveState(state);
  return { error: null };
}

function buildTransaction(userId, txnInput) {
  return {
    id: newId("txn"),
    date: txnInput.date,
    type: txnInput.type,
    category: txnInput.category,
    description: txnInput.description || "",
    account: txnInput.account,
    transferAccount: txnInput.type === "Transfer" ? txnInput.transferAccount || "" : "",
    amount: Number(txnInput.amount),
    billId: txnInput.billId || undefined,
    invoiceId: txnInput.invoiceId || undefined,
    createdAt: nowISO(),
  };
}

export async function listTransactions() {
  const rows = [...loadState().transactions];
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
  return ok(rows);
}

export async function createTransaction(userId, txn) {
  const state = loadState();
  const row = buildTransaction(userId, txn);
  state.transactions.push(row);
  saveState(state);
  return ok(row);
}

export async function updateTransaction(id, patch) {
  const state = loadState();
  const idx = state.transactions.findIndex((t) => t.id === id);
  if (idx === -1) return err("Couldn't find this transaction.");
  const existing = state.transactions[idx];
  const row = {
    ...existing,
    date: patch.date,
    type: patch.type,
    category: patch.category,
    description: patch.description || "",
    account: patch.account,
    transferAccount: patch.type === "Transfer" ? patch.transferAccount || "" : "",
    amount: Number(patch.amount),
    billId: patch.billId || undefined,
    invoiceId: patch.invoiceId || undefined,
  };
  state.transactions[idx] = row;
  saveState(state);
  return ok(row);
}

export async function deleteTransaction(id) {
  const state = loadState();
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveState(state);
  return { error: null };
}

export async function listBudgets() {
  return ok({ ...loadState().budgets });
}

export async function setBudget(userId, category, amount) {
  const state = loadState();
  state.budgets[category] = Number(amount);
  saveState(state);
  return ok({ category, amount: Number(amount) });
}

export async function removeBudget(userId, category) {
  const state = loadState();
  delete state.budgets[category];
  saveState(state);
  return { error: null };
}

export async function listBills() {
  return ok([...loadState().bills]);
}

export async function createBill(userId, bill) {
  const state = loadState();
  const row = {
    id: newId("bill"),
    name: bill.name,
    category: bill.category,
    amount: Number(bill.amount),
    dueDay: Number(bill.dueDay),
    recurring: bill.recurring !== false,
    provider: bill.provider || "custom",
    account: bill.account || "",
    paidCycle: null,
    paidTransactionId: null,
  };
  state.bills.push(row);
  saveState(state);
  return ok(row);
}

export async function updateBill(id, patch) {
  const state = loadState();
  const idx = state.bills.findIndex((b) => b.id === id);
  if (idx === -1) return err("Couldn't find this bill.");
  const existing = state.bills[idx];
  state.bills[idx] = {
    ...existing,
    name: patch.name,
    category: patch.category,
    amount: Number(patch.amount),
    dueDay: Number(patch.dueDay),
    recurring: patch.recurring !== false,
    provider: patch.provider || "custom",
    account: patch.account || "",
  };
  saveState(state);
  return ok(state.bills[idx]);
}

export async function deleteBill(id) {
  const state = loadState();
  state.bills = state.bills.filter((b) => b.id !== id);
  saveState(state);
  return { error: null };
}

export async function payBill(userId, bill, accountId, date) {
  const state = loadState();
  const live = state.bills.find((b) => b.id === bill.id);
  if (!live) return err("Couldn't find this bill.");

  const cycle = getActiveBillingCycle(live, new Date(date));
  if (live.paidCycle === cycle) return err("This bill has already been paid for this cycle.");

  const txn = buildTransaction(userId, {
    date,
    type: "Expense",
    category: live.category,
    description: `${live.name} payment`,
    account: accountId,
    amount: live.amount,
    billId: live.id,
  });
  state.transactions.push(txn);
  live.paidCycle = cycle;
  live.paidTransactionId = txn.id;
  saveState(state);
  return ok({ bill: { ...live }, transaction: txn });
}

export async function unpayBill(bill) {
  const state = loadState();
  const live = state.bills.find((b) => b.id === bill.id);
  if (!live) return err("Couldn't find this bill.");
  if (live.paidTransactionId) {
    state.transactions = state.transactions.filter((t) => t.id !== live.paidTransactionId);
  }
  live.paidCycle = null;
  live.paidTransactionId = null;
  saveState(state);
  return ok({ ...live });
}

export async function listInvoices() {
  return ok([...loadState().invoices]);
}

export async function createInvoice(userId, invoice) {
  const state = loadState();
  const row = {
    id: newId("invoice"),
    invoiceNumber: invoice.invoiceNumber,
    client: invoice.client,
    invoiceDate: invoice.invoiceDate,
    amount: Number(invoice.amount),
    status: "Unpaid",
    paymentDate: null,
    paymentAccountId: null,
    transactionId: null,
  };
  state.invoices.push(row);
  saveState(state);
  return ok(row);
}

export async function updateInvoice(id, patch) {
  const state = loadState();
  const idx = state.invoices.findIndex((i) => i.id === id);
  if (idx === -1) return err("Couldn't find this invoice.");
  state.invoices[idx] = {
    ...state.invoices[idx],
    invoiceNumber: patch.invoiceNumber,
    client: patch.client,
    invoiceDate: patch.invoiceDate,
    amount: Number(patch.amount),
  };
  saveState(state);
  return ok(state.invoices[idx]);
}

export async function deleteInvoice(id) {
  const state = loadState();
  state.invoices = state.invoices.filter((i) => i.id !== id);
  saveState(state);
  return { error: null };
}

export async function createGeneratedInvoice(userId, model) {
  const state = loadState();
  const row = {
    id: newId("invoice"),
    invoiceNumber: model.invoiceNumber,
    client: model.billTo?.name || "",
    invoiceDate: model.invoiceDate,
    amount: model.total,
    status: "Unpaid",
    paymentDate: null,
    paymentAccountId: null,
    transactionId: null,
    kind: "generated",
    dueDate: model.dueDate || null,
    paymentTerms: model.paymentTerms || null,
    currency: model.currency || "INR",
    seller: model.seller || null,
    billTo: model.billTo || null,
    items: model.items || [],
    discount: Number(model.discount) || 0,
    taxRate: Number(model.taxRate) || 0,
    notes: model.notes || null,
    paymentInfo: model.paymentInfo || null,
    pdfPath: model.pdfPath || null,
    pdfGeneratedAt: model.pdfPath ? nowISO() : null,
    needsRegeneration: false,
  };
  state.invoices.push(row);
  saveState(state);
  return ok(row);
}

export async function updateGeneratedInvoice(id, model, regenerated) {
  const state = loadState();
  const idx = state.invoices.findIndex((i) => i.id === id);
  if (idx === -1) return err("Couldn't find this invoice.");
  const existing = state.invoices[idx];
  const row = {
    ...existing,
    invoiceNumber: model.invoiceNumber,
    client: model.billTo?.name || "",
    invoiceDate: model.invoiceDate,
    amount: model.total,
    dueDate: model.dueDate || null,
    paymentTerms: model.paymentTerms || null,
    currency: model.currency || "INR",
    seller: model.seller || null,
    billTo: model.billTo || null,
    items: model.items || [],
    discount: Number(model.discount) || 0,
    taxRate: Number(model.taxRate) || 0,
    notes: model.notes || null,
    paymentInfo: model.paymentInfo || null,
  };
  if (regenerated) {
    row.pdfPath = model.pdfPath || null;
    row.pdfGeneratedAt = nowISO();
    row.needsRegeneration = false;
  } else {
    row.needsRegeneration = true;
  }
  state.invoices[idx] = row;
  saveState(state);
  return ok(row);
}

export async function payInvoice(userId, invoice, accountId, date) {
  const state = loadState();
  const live = state.invoices.find((i) => i.id === invoice.id);
  if (!live) return err("Couldn't find this invoice.");
  if (live.status === "Paid" || live.transactionId) return err("This invoice has already been paid.");

  const txn = buildTransaction(userId, {
    date,
    type: "Income",
    category: "Freelance",
    description: `Invoice ${live.invoiceNumber} payment`,
    account: accountId,
    amount: live.amount,
    invoiceId: live.id,
  });
  state.transactions.push(txn);
  live.status = "Paid";
  live.paymentDate = date;
  live.paymentAccountId = accountId;
  live.transactionId = txn.id;
  saveState(state);
  return ok({ invoice: { ...live }, transaction: txn });
}

export async function listGoals() {
  return ok([...loadState().goals]);
}

export async function listClients() {
  const state = loadState();
  if (!state.clients) state.clients = [];
  return ok([...state.clients]);
}

export async function createClient(userId, client) {
  const state = loadState();
  if (!state.clients) state.clients = [];
  const row = { id: newId("client"), ...client };
  state.clients.push(row);
  saveState(state);
  return ok(row);
}

export async function updateClient(id, client) {
  const state = loadState();
  if (!state.clients) state.clients = [];
  const idx = state.clients.findIndex((c) => c.id === id);
  if (idx === -1) return err("Couldn't find this client.");
  state.clients[idx] = { ...state.clients[idx], ...client, id };
  saveState(state);
  return ok(state.clients[idx]);
}

export async function deleteClient(id) {
  const state = loadState();
  if (!state.clients) state.clients = [];
  state.clients = state.clients.filter((c) => c.id !== id);
  saveState(state);
  return { error: null };
}

export async function createGoal(userId, goal) {
  const state = loadState();
  const row = {
    id: newId("goal"),
    name: goal.name,
    target: Number(goal.target),
    current: Number(goal.current) || 0,
    deadline: goal.deadline || null,
  };
  state.goals.push(row);
  saveState(state);
  return ok(row);
}

export async function updateGoal(id, patch) {
  const state = loadState();
  const idx = state.goals.findIndex((g) => g.id === id);
  if (idx === -1) return err("Couldn't find this goal.");
  const existing = state.goals[idx];
  state.goals[idx] = {
    ...existing,
    name: patch.name,
    target: Number(patch.target),
    current: patch.current !== undefined ? Number(patch.current) : existing.current,
    deadline: patch.deadline || null,
  };
  saveState(state);
  return ok(state.goals[idx]);
}

export async function deleteGoal(id) {
  const state = loadState();
  state.goals = state.goals.filter((g) => g.id !== id);
  saveState(state);
  return { error: null };
}

export async function contributeGoal(id, amount) {
  const state = loadState();
  const idx = state.goals.findIndex((g) => g.id === id);
  if (idx === -1) return err("Couldn't find this goal.");
  state.goals[idx] = { ...state.goals[idx], current: Number(state.goals[idx].current) + Number(amount) };
  saveState(state);
  return ok(state.goals[idx]);
}

export async function listEmiPlans() {
  return ok([...loadState().emiPlans]);
}

export async function createEmiPlan(userId, plan) {
  const state = loadState();
  const planRow = {
    id: newId("emi-plan"),
    transactionId: plan.transactionId,
    accountId: plan.accountId,
    name: null,
    source: null,
    principal: Number(plan.principal),
    interestRate: Number(plan.interestRate) || 0,
    tenureMonths: Number(plan.tenureMonths),
    emiAmount: Number(plan.emiAmount),
    totalInterest: Number(plan.totalInterest),
    totalPayable: Number(plan.totalPayable),
    startDate: plan.startDate,
    status: "Active",
    createdAt: nowISO(),
  };

  const schedule = generateLoanSchedule(planRow.principal, planRow.interestRate, planRow.tenureMonths, planRow.emiAmount, planRow.startDate);
  const installments = schedule.map((row) => ({
    id: newId("emi-inst"),
    emiPlanId: planRow.id,
    installmentNumber: row.installmentNumber,
    dueDate: toISO(row.dueDate),
    amount: row.emiAmount,
    status: "Upcoming",
    paidDate: null,
    paymentTransactionId: null,
    settledViaPreclosure: false,
  }));

  state.emiPlans.push(planRow);
  state.emiInstallments.push(...installments);
  saveState(state);
  return ok({ plan: planRow, installments });
}

export async function deleteEmiPlan(id) {
  const state = loadState();
  state.emiPlans = state.emiPlans.filter((p) => p.id !== id);
  state.emiInstallments = state.emiInstallments.filter((i) => i.emiPlanId !== id);
  saveState(state);
  return { error: null };
}

export async function precloseEmiPlan(planId, sourceAccountId, date, description) {
  const state = loadState();
  const plan = state.emiPlans.find((p) => p.id === planId);
  if (!plan) return err("Couldn't find this EMI plan.");
  const remaining = state.emiInstallments.filter((i) => i.emiPlanId === planId && i.status !== "Paid");
  if (remaining.length === 0) return err("No remaining installments to pre-close.");

  const total = remaining.reduce((sum, i) => sum + Number(i.amount), 0);
  const txn = buildTransaction(null, {
    date,
    type: "Transfer",
    category: "EMI",
    description: description || "EMI plan pre-closure",
    account: sourceAccountId,
    transferAccount: plan.accountId,
    amount: total,
  });
  state.transactions.push(txn);

  const settledIds = new Set(remaining.map((i) => i.id));
  state.emiInstallments = state.emiInstallments.map((i) =>
    settledIds.has(i.id) ? { ...i, status: "Paid", paidDate: date, paymentTransactionId: txn.id, settledViaPreclosure: true } : i
  );
  plan.status = "Preclosed";
  saveState(state);
  return {
    data: {
      transaction: txn,
      plan: { ...plan },
      installments: state.emiInstallments.filter((i) => settledIds.has(i.id)),
    },
    error: null,
  };
}

export async function listEmiInstallments() {
  const rows = [...loadState().emiInstallments];
  rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return ok(rows);
}

export async function payEmiInstallment(installment, sourceAccountId, date, description) {
  const state = loadState();
  const idx = state.emiInstallments.findIndex((i) => i.id === installment.id);
  if (idx === -1 || state.emiInstallments[idx].status === "Paid") return err("Couldn't record the EMI payment.");
  const live = state.emiInstallments[idx];
  const plan = state.emiPlans.find((p) => p.id === live.emiPlanId);

  const txn = buildTransaction(null, {
    date,
    type: "Transfer",
    category: "EMI",
    description: description || "EMI installment payment",
    account: sourceAccountId,
    transferAccount: plan?.accountId,
    amount: live.amount,
  });
  state.transactions.push(txn);

  state.emiInstallments[idx] = { ...live, status: "Paid", paidDate: date, paymentTransactionId: txn.id };

  let planChanged = null;
  if (plan) {
    const stillUnpaid = state.emiInstallments.some((i) => i.emiPlanId === plan.id && i.status !== "Paid");
    if (!stillUnpaid && plan.status !== "Completed") {
      plan.status = "Completed";
      planChanged = { ...plan };
    }
  }
  saveState(state);
  return ok({ installment: state.emiInstallments[idx], transaction: txn, plan: planChanged });
}

export async function unpayEmiInstallment(installment) {
  const state = loadState();
  const idx = state.emiInstallments.findIndex((i) => i.id === installment.id);
  if (idx === -1) return err("Couldn't find this installment.");
  const live = state.emiInstallments[idx];
  if (live.settledViaPreclosure) {
    return err("This installment was settled as part of an EMI pre-closure and can't be undone individually.");
  }
  if (live.paymentTransactionId) {
    state.transactions = state.transactions.filter((t) => t.id !== live.paymentTransactionId);
  }
  state.emiInstallments[idx] = { ...live, status: "Upcoming", paidDate: null, paymentTransactionId: null };

  let planChanged = null;
  const plan = state.emiPlans.find((p) => p.id === live.emiPlanId);
  if (plan && plan.status === "Completed") {
    plan.status = "Active";
    planChanged = { ...plan };
  }
  saveState(state);
  return ok({ installment: state.emiInstallments[idx], plan: planChanged });
}

function computeOutstanding(state, accountId) {
  const acc = state.accounts.find((a) => a.id === accountId);
  if (!acc || acc.type !== "Credit Card") return 0;
  let outstanding = Number(acc.opening) || 0;
  state.transactions.forEach((tx) => {
    if (tx.type === "Expense" && tx.account === accountId) outstanding += Number(tx.amount);
    else if (tx.type === "Income" && tx.account === accountId) outstanding -= Number(tx.amount);
    else if (tx.type === "Transfer") {
      if (tx.transferAccount === accountId) outstanding -= Number(tx.amount);
      if (tx.account === accountId) outstanding += Number(tx.amount);
    }
  });
  return outstanding;
}

export async function listCreditCardStatements() {
  const rows = [...loadState().creditCardStatements];
  rows.sort((a, b) => (a.statementDate < b.statementDate ? -1 : a.statementDate > b.statementDate ? 1 : 0));
  return ok(rows);
}

export async function generateStatement(accountId, cycleKey, statementDate, dueDate) {
  const state = loadState();
  const exists = state.creditCardStatements.some((s) => s.accountId === accountId && s.cycleKey === cycleKey);
  if (exists) return err("A statement for this billing cycle already exists.");

  const row = {
    id: newId("cc-stmt"),
    accountId,
    cycleKey,
    statementDate,
    dueDate: dueDate || null,
    statementBalance: computeOutstanding(state, accountId),
    createdAt: nowISO(),
  };
  state.creditCardStatements.push(row);
  saveState(state);
  return ok(row);
}

export async function listLoanInstallments() {
  const rows = [...loadState().loanInstallments];
  rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return ok(rows);
}

export async function disburseLoan(accountId, destinationAccountId, date, installments, description) {
  const state = loadState();
  const alreadyDisbursed = state.loanInstallments.some((i) => i.accountId === accountId);
  if (alreadyDisbursed) return err("This loan has already been disbursed.");
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return err("Couldn't find this loan account.");

  const txn = buildTransaction(null, {
    date,
    type: "Transfer",
    category: "Other",
    description: description || "Loan disbursed",
    account: accountId,
    transferAccount: destinationAccountId,
    amount: account.opening,
  });
  state.transactions.push(txn);

  const rows = installments.map((i) => ({
    id: newId("loan-inst"),
    accountId,
    installmentNumber: i.installmentNumber,
    dueDate: toISO(i.dueDate),
    emiAmount: i.emiAmount,
    principalComponent: i.principalComponent,
    interestComponent: i.interestComponent,
    status: "Upcoming",
    paidDate: null,
    principalTransactionId: null,
    interestTransactionId: null,
  }));
  state.loanInstallments.push(...rows);
  saveState(state);
  return ok({ transaction: txn, installments: rows });
}

export async function payLoanInstallment(installment, sourceAccountId, date, description) {
  const state = loadState();
  const idx = state.loanInstallments.findIndex((i) => i.id === installment.id);
  if (idx === -1 || state.loanInstallments[idx].status === "Paid") return err("Couldn't record the loan payment.");
  const live = state.loanInstallments[idx];

  let interestTxn = null;
  if (Number(live.interestComponent) > 0) {
    interestTxn = buildTransaction(null, {
      date,
      type: "Expense",
      category: "EMI",
      description: description || "Loan EMI — interest",
      account: sourceAccountId,
      amount: live.interestComponent,
    });
    state.transactions.push(interestTxn);
  }
  const principalTxn = buildTransaction(null, {
    date,
    type: "Transfer",
    category: "EMI",
    description: description || "Loan EMI — principal",
    account: sourceAccountId,
    transferAccount: live.accountId,
    amount: live.principalComponent,
  });
  state.transactions.push(principalTxn);

  state.loanInstallments[idx] = {
    ...live,
    status: "Paid",
    paidDate: date,
    principalTransactionId: principalTxn.id,
    interestTransactionId: interestTxn ? interestTxn.id : null,
  };

  let loanStatus = null;
  const stillUnpaid = state.loanInstallments.some((i) => i.accountId === live.accountId && i.status !== "Paid");
  if (!stillUnpaid) {
    const account = state.accounts.find((a) => a.id === live.accountId);
    if (account) account.loanStatus = "Completed";
    loanStatus = "Completed";
  }
  saveState(state);
  return ok({
    installment: state.loanInstallments[idx],
    principalTransaction: principalTxn,
    interestTransaction: interestTxn,
    loanStatus,
  });
}

export async function precloseLoan(accountId, sourceAccountId, date, description) {
  const state = loadState();
  const remaining = state.loanInstallments.filter((i) => i.accountId === accountId && i.status === "Upcoming");
  if (remaining.length === 0) return err("No remaining installments to pre-close.");

  const total = remaining.reduce((sum, i) => sum + Number(i.principalComponent), 0);
  const txn = buildTransaction(null, {
    date,
    type: "Transfer",
    category: "EMI",
    description: description || "Loan pre-closure",
    account: sourceAccountId,
    transferAccount: accountId,
    amount: total,
  });
  state.transactions.push(txn);

  const settledIds = new Set(remaining.map((i) => i.id));
  state.loanInstallments = state.loanInstallments.map((i) =>
    settledIds.has(i.id) ? { ...i, status: "Preclosed", paidDate: date, principalTransactionId: txn.id } : i
  );
  const account = state.accounts.find((a) => a.id === accountId);
  if (account) account.loanStatus = "Preclosed";
  saveState(state);
  return {
    data: {
      transaction: txn,
      installments: state.loanInstallments.filter((i) => settledIds.has(i.id)),
      loanStatus: "Preclosed",
    },
    error: null,
  };
}
