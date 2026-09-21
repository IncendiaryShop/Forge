import { useState, useEffect, useCallback, useRef } from "react";
import { AppCtx } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthCtx";
import { theme } from "./styles/theme";
import { PAGE_TITLES } from "./utils/constants";
import { getActiveBillingCycle } from "./utils/billCycle";
import { fmt, todayISO } from "./utils/helpers";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { ConfigError } from "./components/ConfigError";
import { AuthGate } from "./components/AuthGate";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";
import { MigrationGate } from "./components/MigrationGate";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { MobileBrandHeader } from "./components/MobileBrandHeader";
import { Modal } from "./components/Modal";
import { PrimaryButton } from "./components/PrimaryButton";
import { ScrollBounceBoundary } from "./components/ScrollBounceBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { TransactionForm } from "./forms/TransactionForm";
import { Dashboard } from "./pages/Dashboard";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { BudgetPage } from "./pages/BudgetPage";
import { BillsPage } from "./pages/BillsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { GoalsPage } from "./pages/GoalsPage";

import * as realAccountsSvc from "./services/accounts";
import * as realTxnSvc from "./services/transactions";
import * as realBudgetsSvc from "./services/budgets";
import * as realBillsSvc from "./services/bills";
import * as realInvoicesSvc from "./services/invoices";
import * as realInvoiceGeneratorSvc from "./services/invoiceGenerator";
import * as invoiceStorageSvc from "./services/invoiceStorage";
import { buildInvoicePdfBytes } from "./lib/pdf/invoicePdf";
import { computeTotals } from "./utils/invoiceCalc";
import * as realGoalsSvc from "./services/goals";
import * as realClientsSvc from "./services/clients";
import * as realEmiPlansSvc from "./services/emiPlans";
import * as realEmiInstallmentsSvc from "./services/emiInstallments";
import * as realCreditCardStatementsSvc from "./services/creditCardStatements";
import * as realLoanInstallmentsSvc from "./services/loanInstallments";

import * as demoSvc from "./demo/demoStore";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function CenteredScreen({ children }) {
  return <div className="min-h-screen flex items-center justify-center bg-bg px-6 text-center"><div className="text-subtext text-base">{children}</div></div>;
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm rounded-[14px] border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm shadow-lg flex items-start gap-3">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="opacity-70 hover:opacity-100" aria-label="Dismiss">✕</button>
    </div>
  );
}

function AuthenticatedApp({ userId, onSignOut, isDemoMode = false, onCreateAccount }) {

  const accountsSvc = isDemoMode ? demoSvc : realAccountsSvc;
  const txnSvc = isDemoMode ? demoSvc : realTxnSvc;
  const budgetsSvc = isDemoMode ? demoSvc : realBudgetsSvc;
  const billsSvc = isDemoMode ? demoSvc : realBillsSvc;
  const invoicesSvc = isDemoMode ? demoSvc : realInvoicesSvc;
  const invoiceGeneratorSvc = isDemoMode ? demoSvc : realInvoiceGeneratorSvc;
  const goalsSvc = isDemoMode ? demoSvc : realGoalsSvc;
  const clientsSvc = isDemoMode ? demoSvc : realClientsSvc;
  const emiPlansSvc = isDemoMode ? demoSvc : realEmiPlansSvc;
  const emiInstallmentsSvc = isDemoMode ? demoSvc : realEmiInstallmentsSvc;
  const creditCardStatementsSvc = isDemoMode ? demoSvc : realCreditCardStatementsSvc;
  const loanInstallmentsSvc = isDemoMode ? demoSvc : realLoanInstallmentsSvc;

  const [data, setData] = useState(null);
  const [dataStatus, setDataStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState("dashboard");

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const channelsRef = useRef([]);

  const loadAll = useCallback(async () => {
    setDataStatus("loading");
    const [accounts, transactions, budgets, bills, invoices, goals, emiPlans, emiInstallments, creditCardStatements, loanInstallments, clients] = await Promise.all([
      accountsSvc.listAccounts(),
      txnSvc.listTransactions(),
      budgetsSvc.listBudgets(),
      billsSvc.listBills(),
      invoicesSvc.listInvoices(),
      goalsSvc.listGoals(),
      emiPlansSvc.listEmiPlans(),
      emiInstallmentsSvc.listEmiInstallments(),
      creditCardStatementsSvc.listCreditCardStatements(),
      loanInstallmentsSvc.listLoanInstallments(),
      clientsSvc.listClients(),
    ]);
    const failed = [accounts, transactions, budgets, bills, invoices, goals, emiPlans, emiInstallments, creditCardStatements, loanInstallments].find((r) => r.error);
    if (failed) {
      setLoadError(failed.error.message);
      setDataStatus("error");
      return;
    }
    setData({
      accounts: accounts.data,
      transactions: transactions.data,
      budgets: budgets.data,
      bills: bills.data,
      invoices: invoices.data,
      goals: goals.data,
      emiPlans: emiPlans.data,
      emiInstallments: emiInstallments.data,
      creditCardStatements: creditCardStatements.data,
      loanInstallments: loanInstallments.data,

      clients: clients.error ? [] : clients.data,
    });
    setDataStatus("ready");

  }, [accountsSvc, txnSvc, budgetsSvc, billsSvc, invoicesSvc, goalsSvc, emiPlansSvc, emiInstallmentsSvc, creditCardStatementsSvc, loanInstallmentsSvc, clientsSvc]);

  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} • Forge`;
  }, [page]);

  useEffect(() => {
    queueMicrotask(loadAll);
  }, [loadAll, userId]);

  useEffect(() => {

    if (isDemoMode) return;

    const tables = [
      { name: "accounts", refetch: accountsSvc.listAccounts, key: "accounts" },
      { name: "transactions", refetch: txnSvc.listTransactions, key: "transactions" },
      { name: "budgets", refetch: budgetsSvc.listBudgets, key: "budgets" },
      { name: "bills", refetch: billsSvc.listBills, key: "bills" },
      { name: "invoices", refetch: invoicesSvc.listInvoices, key: "invoices" },
      { name: "goals", refetch: goalsSvc.listGoals, key: "goals" },
      { name: "emi_plans", refetch: emiPlansSvc.listEmiPlans, key: "emiPlans" },
      { name: "emi_installments", refetch: emiInstallmentsSvc.listEmiInstallments, key: "emiInstallments" },
      { name: "credit_card_statements", refetch: creditCardStatementsSvc.listCreditCardStatements, key: "creditCardStatements" },
      { name: "loan_installments", refetch: loanInstallmentsSvc.listLoanInstallments, key: "loanInstallments" },
      { name: "clients", refetch: clientsSvc.listClients, key: "clients" },
    ];

    const channels = tables.map(({ name, refetch, key }) =>
      supabase
        .channel(`forge-${name}-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: name, filter: `user_id=eq.${userId}` },
          async () => {
            const r = await refetch();
            if (!r.error) setData((d) => (d ? { ...d, [key]: r.data } : d));
          }
        )
        .subscribe()
    );
    channelsRef.current = channels;

    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };

  }, [userId, isDemoMode, accountsSvc, txnSvc, budgetsSvc, billsSvc, invoicesSvc, goalsSvc, emiPlansSvc, emiInstallmentsSvc, creditCardStatementsSvc, loanInstallmentsSvc, clientsSvc]);

  const accountBalance = (accountId) => {
    if (!data) return 0;
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc) return 0;
    let bal = Number(acc.opening) || 0;
    data.transactions.forEach((t) => {
      if (t.type === "Income" && t.account === accountId) bal += Number(t.amount);
      else if (t.type === "Expense" && t.account === accountId) bal -= Number(t.amount);
      else if (t.type === "Transfer") {
        if (t.account === accountId) bal -= Number(t.amount);
        if (t.transferAccount === accountId) bal += Number(t.amount);
      }
    });
    return bal;
  };

  const accountOutstanding = (accountId) => {
    if (!data) return 0;
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc || acc.type !== "Credit Card") return 0;
    let outstanding = Number(acc.opening) || 0;
    data.transactions.forEach((t) => {
      if (t.type === "Expense" && t.account === accountId) outstanding += Number(t.amount);
      else if (t.type === "Income" && t.account === accountId) outstanding -= Number(t.amount);
      else if (t.type === "Transfer") {
        if (t.transferAccount === accountId) outstanding -= Number(t.amount);
        if (t.account === accountId) outstanding += Number(t.amount);
      }
    });
    return outstanding;
  };

  const getAvailableBalance = (accountId, excludeTxn) => {
    let bal = accountBalance(accountId);
    if (excludeTxn) {
      if (excludeTxn.type === "Income" && excludeTxn.account === accountId) bal -= Number(excludeTxn.amount) || 0;
      else if (excludeTxn.type === "Expense" && excludeTxn.account === accountId) bal += Number(excludeTxn.amount) || 0;
      else if (excludeTxn.type === "Transfer") {
        if (excludeTxn.account === accountId) bal += Number(excludeTxn.amount) || 0;
        if (excludeTxn.transferAccount === accountId) bal -= Number(excludeTxn.amount) || 0;
      }
    }
    return bal;
  };

  const insufficientFundsError = (accountId, amount, excludeTxn) => {
    if (!data) return null;
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc || acc.type === "Credit Card") return null;
    const available = getAvailableBalance(accountId, excludeTxn);
    const requested = Number(amount) || 0;
    if (requested > available) {
      return `Insufficient balance in ${acc.name}. Available balance: ${fmt(available)}.`;
    }
    return null;
  };

  const creditCardPaymentError = (destinationAccountId, amount, excludeTxn) => {
    if (!data) return null;
    const acc = data.accounts.find((a) => a.id === destinationAccountId);
    if (!acc || acc.type !== "Credit Card") return null;

    let outstanding = accountOutstanding(destinationAccountId);
    if (excludeTxn && excludeTxn.type === "Transfer" && excludeTxn.transferAccount === destinationAccountId) {
      outstanding += Number(excludeTxn.amount) || 0;
    }

    const requested = Number(amount) || 0;
    if (outstanding <= 0) {
      return "No outstanding balance on this credit card.";
    }
    if (requested > outstanding) {
      return `Payment exceeds credit card outstanding. Current outstanding: ${fmt(outstanding)}.`;
    }
    return null;
  };

  const loanOutstandingPrincipal = (accountId) => {
    if (!data) return 0;
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc || acc.type !== "Loan") return 0;
    let outstanding = Number(acc.opening) || 0;
    data.transactions.forEach((t) => {
      if (t.type === "Transfer" && t.transferAccount === accountId) outstanding -= Number(t.amount);
    });
    return Math.max(outstanding, 0);
  };

  const withError = async (promise) => {
    const result = await promise;
    if (result?.error) setActionError(result.error.message);
    return result;
  };

  const ctx = {
    data: data ? {
      ...data,

      bills: data.bills.map((b) => ({ ...b, paid: b.paidCycle === getActiveBillingCycle(b, startOfToday()) })),
    } : data,
    dataStatus,
    theme,
    page,
    setPage,
    openQuickAdd: () => setQuickAddOpen(true),
    accountBalance,
    accountOutstanding,
    insufficientFundsError,
    creditCardPaymentError,
    loanOutstandingPrincipal,
    userId,
    signOut: onSignOut,
    reload: loadAll,
    isDemoMode,
    onCreateAccount,
    resetDemo: isDemoMode
      ? () => {
          demoSvc.resetDemo();
          loadAll();
        }
      : undefined,

    addTransaction: async (t) => {
      if (t.type === "Expense" || t.type === "Transfer") {
        const fundsError = insufficientFundsError(t.account, t.amount);
        if (fundsError) { setActionError(fundsError); return; }
      }
      if (t.type === "Transfer") {
        const cardError = creditCardPaymentError(t.transferAccount, t.amount);
        if (cardError) { setActionError(cardError); return; }
      }
      const r = await withError(txnSvc.createTransaction(userId, t));
      if (r.data) setData((d) => d && ({ ...d, transactions: [...d.transactions, r.data] }));
    },
    updateTransaction: async (id, t) => {
      const existingTxn = data?.transactions.find((x) => x.id === id);
      if (t.type === "Expense" || t.type === "Transfer") {
        const fundsError = insufficientFundsError(t.account, t.amount, existingTxn);
        if (fundsError) { setActionError(fundsError); return; }
      }
      if (t.type === "Transfer") {
        const cardError = creditCardPaymentError(t.transferAccount, t.amount, existingTxn);
        if (cardError) { setActionError(cardError); return; }
      }
      const r = await withError(txnSvc.updateTransaction(id, t));
      if (r.data) setData((d) => d && ({ ...d, transactions: d.transactions.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteTransaction: async (id) => {
      const bill = data?.bills.find((b) => b.paidTransactionId === id);
      const r = await withError(txnSvc.deleteTransaction(id));
      if (r.error) return;

      if (bill) await withError(billsSvc.unpayBill(bill));
      setData((d) => d && ({ ...d, transactions: d.transactions.filter((x) => x.id !== id) }));
    },

    addAccount: async (a) => {
      const r = await withError(accountsSvc.createAccount(userId, a));
      if (r.data) setData((d) => d && ({ ...d, accounts: [...d.accounts, r.data] }));
    },
    updateAccount: async (id, a) => {
      const r = await withError(accountsSvc.updateAccount(id, a));
      if (r.data) setData((d) => d && ({ ...d, accounts: d.accounts.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteAccount: async (id) => {
      const r = await withError(accountsSvc.deleteAccount(id));
      if (!r.error) setData((d) => d && ({ ...d, accounts: d.accounts.filter((x) => x.id !== id) }));
    },

    setBudget: async (cat, amount) => {
      const r = await withError(budgetsSvc.setBudget(userId, cat, amount));
      if (!r.error) setData((d) => d && ({ ...d, budgets: { ...d.budgets, [cat]: Number(amount) } }));
    },
    removeBudget: async (cat) => {
      const r = await withError(budgetsSvc.removeBudget(userId, cat));
      if (!r.error) setData((d) => { if (!d) return d; const b = { ...d.budgets }; delete b[cat]; return { ...d, budgets: b }; });
    },

    addBill: async (b) => {
      const r = await withError(billsSvc.createBill(userId, b));
      if (r.data) setData((d) => d && ({ ...d, bills: [...d.bills, r.data] }));
    },
    updateBill: async (id, b) => {
      const r = await withError(billsSvc.updateBill(id, b));
      if (r.data) setData((d) => d && ({ ...d, bills: d.bills.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteBill: async (id) => {
      const r = await withError(billsSvc.deleteBill(id));
      if (!r.error) setData((d) => d && ({ ...d, bills: d.bills.filter((x) => x.id !== id) }));
    },
    toggleBillPaid: async (id, accountId) => {
      const bill = data?.bills.find((b) => b.id === id);
      if (!bill) return;
      const cycle = getActiveBillingCycle(bill, startOfToday());
      const isPaidThisCycle = bill.paidCycle === cycle;

      if (isPaidThisCycle) {
        const r = await withError(billsSvc.unpayBill(bill));
        if (r.data) setData((d) => d && ({
          ...d,
          bills: d.bills.map((b) => (b.id === id ? r.data : b)),
          transactions: bill.paidTransactionId ? d.transactions.filter((t) => t.id !== bill.paidTransactionId) : d.transactions,
        }));
        return;
      }

      const resolvedAccount = accountId || bill.account || data.accounts[0]?.id || "";
      const dateStr = todayISO();
      const r = await withError(billsSvc.payBill(userId, bill, resolvedAccount, dateStr));
      if (r.data) setData((d) => d && ({
        ...d,
        bills: d.bills.map((b) => (b.id === id ? r.data.bill : b)),
        transactions: [...d.transactions, r.data.transaction],
      }));
    },

    addInvoice: async (inv) => {
      const r = await withError(invoicesSvc.createInvoice(userId, inv));
      if (r.data) setData((d) => d && ({ ...d, invoices: [...d.invoices, r.data] }));
    },
    updateInvoice: async (id, inv) => {
      const r = await withError(invoicesSvc.updateInvoice(id, inv));
      if (r.data) setData((d) => d && ({ ...d, invoices: d.invoices.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteInvoice: async (id) => {
      const r = await withError(invoicesSvc.deleteInvoice(id));
      if (!r.error) setData((d) => d && ({ ...d, invoices: d.invoices.filter((x) => x.id !== id) }));
    },
    markInvoicePaid: async (id, accountId, paymentDate) => {
      const invoice = data?.invoices.find((x) => x.id === id);
      if (!invoice) return;
      if (invoice.status === "Paid" || invoice.transactionId) return;

      const resolvedAccount = accountId || data.accounts[0]?.id || "";
      const resolvedDate = paymentDate || todayISO();
      const r = await withError(invoicesSvc.payInvoice(userId, invoice, resolvedAccount, resolvedDate));
      if (r.data) setData((d) => d && ({
        ...d,
        invoices: d.invoices.map((x) => (x.id === id ? r.data.invoice : x)),
        transactions: [...d.transactions, r.data.transaction],
      }));
    },

    generateInvoice: async (model) => {
      let bytes;
      try {
        bytes = await buildInvoicePdfBytes(model);
      } catch (e) {
        return { error: { message: e?.message || "Couldn't generate the PDF. Please check the invoice details." } };
      }
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));

      let pdfPath = null;
      if (!isDemoMode) {
        const up = await withError(invoiceStorageSvc.uploadInvoicePdf(userId, model.invoiceNumber, bytes));
        if (up.error) return { error: up.error };
        pdfPath = up.data.path;
      }

      const totals = computeTotals(model.items, model.discount, model.taxRate);
      const r = await withError(invoiceGeneratorSvc.createGeneratedInvoice(userId, { ...model, pdfPath, total: totals.total }));
      if (r.error) {
        if (pdfPath) await invoiceStorageSvc.removeInvoiceFile(pdfPath);
        return { error: r.error };
      }
      setData((d) => d && ({ ...d, invoices: [...d.invoices, r.data] }));
      return { data: r.data, blobUrl };
    },

    saveGeneratedInvoice: async (id, model, regenerate) => {
      let pdfPath = model.pdfPath;
      let blobUrl = null;
      if (regenerate) {
        let bytes;
        try {
          bytes = await buildInvoicePdfBytes(model);
        } catch (e) {
          return { error: { message: e?.message || "Couldn't regenerate the PDF. Please check the invoice details." } };
        }
        blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        if (!isDemoMode) {
          const up = await withError(invoiceStorageSvc.uploadInvoicePdf(userId, model.invoiceNumber, bytes));
          if (up.error) return { error: up.error };
          pdfPath = up.data.path;
        }
      }
      const totals = computeTotals(model.items, model.discount, model.taxRate);
      const r = await withError(invoiceGeneratorSvc.updateGeneratedInvoice(id, { ...model, pdfPath, total: totals.total }, !!regenerate));
      if (r.data) setData((d) => d && ({ ...d, invoices: d.invoices.map((x) => (x.id === id ? r.data : x)) }));
      return { ...r, blobUrl };
    },

    regenerateInvoicePdf: async (id) => {
      const invoice = data?.invoices.find((x) => x.id === id);
      if (!invoice) return { error: { message: "Couldn't find this invoice." } };
      let bytes;
      try {
        bytes = await buildInvoicePdfBytes(invoice);
      } catch (e) {
        return { error: { message: e?.message || "Couldn't regenerate the PDF. Please check the invoice details." } };
      }
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      let pdfPath = invoice.pdfPath;
      if (!isDemoMode) {
        const up = await withError(invoiceStorageSvc.uploadInvoicePdf(userId, invoice.invoiceNumber, bytes));
        if (up.error) return { error: up.error };
        pdfPath = up.data.path;
      }
      const totals = computeTotals(invoice.items, invoice.discount, invoice.taxRate);
      const r = await withError(invoiceGeneratorSvc.updateGeneratedInvoice(id, { ...invoice, pdfPath, total: totals.total }, true));
      if (r.data) setData((d) => d && ({ ...d, invoices: d.invoices.map((x) => (x.id === id ? r.data : x)) }));
      return { ...r, blobUrl };
    },

    addGoal: async (g) => {
      const r = await withError(goalsSvc.createGoal(userId, g));
      if (r.data) setData((d) => d && ({ ...d, goals: [...d.goals, r.data] }));
    },
    updateGoal: async (id, g) => {
      const r = await withError(goalsSvc.updateGoal(id, g));
      if (r.data) setData((d) => d && ({ ...d, goals: d.goals.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteGoal: async (id) => {
      const r = await withError(goalsSvc.deleteGoal(id));
      if (!r.error) setData((d) => d && ({ ...d, goals: d.goals.filter((x) => x.id !== id) }));
    },
    contributeGoal: async (id, amount) => {
      const r = await withError(goalsSvc.contributeGoal(id, amount));
      if (r.data) setData((d) => d && ({ ...d, goals: d.goals.map((x) => (x.id === id ? r.data : x)) }));
    },

    addClient: async (c) => {
      const r = await withError(clientsSvc.createClient(userId, c));
      if (r.data) setData((d) => d && ({ ...d, clients: [...d.clients, r.data] }));
      return r;
    },
    updateClient: async (id, c) => {
      const r = await withError(clientsSvc.updateClient(id, c));
      if (r.data) setData((d) => d && ({ ...d, clients: d.clients.map((x) => (x.id === id ? r.data : x)) }));
      return r;
    },
    deleteClient: async (id) => {
      const r = await withError(clientsSvc.deleteClient(id));
      if (!r.error) setData((d) => d && ({ ...d, clients: d.clients.filter((x) => x.id !== id) }));
      return r;
    },

    convertToEmi: async (transactionId, payload) => {
      const r = await withError(emiPlansSvc.createEmiPlan(userId, { transactionId, ...payload }));
      if (r.data) setData((d) => d && ({
        ...d,
        emiPlans: [...d.emiPlans, r.data.plan],
        emiInstallments: [...d.emiInstallments, ...r.data.installments],
      }));
    },
    deleteEmiPlan: async (id) => {
      const r = await withError(emiPlansSvc.deleteEmiPlan(id));
      if (!r.error) setData((d) => d && ({
        ...d,
        emiPlans: d.emiPlans.filter((x) => x.id !== id),
        emiInstallments: d.emiInstallments.filter((x) => x.emiPlanId !== id),
      }));
    },

    precloseEmiPlan: async (planId, sourceAccountId, date, description) => {
      const r = await withError(emiPlansSvc.precloseEmiPlan(planId, sourceAccountId, date, description));
      if (r.data) setData((d) => d && ({
        ...d,
        emiPlans: d.emiPlans.map((p) => (p.id === r.data.plan.id ? r.data.plan : p)),
        emiInstallments: d.emiInstallments.map((x) => {
          const updated = r.data.installments.find((i) => i.id === x.id);
          return updated || x;
        }),
        transactions: [...d.transactions, r.data.transaction],
      }));
    },
    payEmiInstallment: async (installment, sourceAccountId, date, description) => {
      const r = await withError(emiInstallmentsSvc.payEmiInstallment(installment, sourceAccountId, date, description));
      if (r.data) setData((d) => d && ({
        ...d,
        emiInstallments: d.emiInstallments.map((x) => (x.id === r.data.installment.id ? r.data.installment : x)),
        emiPlans: r.data.plan ? d.emiPlans.map((p) => (p.id === r.data.plan.id ? r.data.plan : p)) : d.emiPlans,
        transactions: [...d.transactions, r.data.transaction],
      }));
    },
    unpayEmiInstallment: async (installment) => {
      const r = await withError(emiInstallmentsSvc.unpayEmiInstallment(installment));
      if (r.data) setData((d) => d && ({
        ...d,
        emiInstallments: d.emiInstallments.map((x) => (x.id === r.data.installment.id ? r.data.installment : x)),
        emiPlans: r.data.plan ? d.emiPlans.map((p) => (p.id === r.data.plan.id ? r.data.plan : p)) : d.emiPlans,
        transactions: installment.paymentTransactionId ? d.transactions.filter((t) => t.id !== installment.paymentTransactionId) : d.transactions,
      }));
    },

    generateStatement: async (accountId, cycleKey, statementDate, dueDate) => {
      const r = await withError(creditCardStatementsSvc.generateStatement(accountId, cycleKey, statementDate, dueDate));
      if (r.data) setData((d) => d && ({ ...d, creditCardStatements: [...d.creditCardStatements, r.data] }));
    },

    disburseLoan: async (accountId, destinationAccountId, date, installments, description) => {
      const r = await withError(loanInstallmentsSvc.disburseLoan(accountId, destinationAccountId, date, installments, description));
      if (r.data) setData((d) => d && ({
        ...d,
        transactions: [...d.transactions, r.data.transaction],
        loanInstallments: [...d.loanInstallments, ...r.data.installments],
        accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, loanStatus: "Active" } : a)),
      }));
    },

    payLoanInstallment: async (installment, sourceAccountId, date, description) => {
      const r = await withError(loanInstallmentsSvc.payLoanInstallment(installment, sourceAccountId, date, description));
      if (r.data) setData((d) => d && ({
        ...d,
        loanInstallments: d.loanInstallments.map((x) => (x.id === r.data.installment.id ? r.data.installment : x)),
        transactions: [
          ...d.transactions,
          r.data.principalTransaction,
          ...(r.data.interestTransaction ? [r.data.interestTransaction] : []),
        ],
        accounts: r.data.loanStatus
          ? d.accounts.map((a) => (a.id === installment.accountId ? { ...a, loanStatus: r.data.loanStatus } : a))
          : d.accounts,
      }));
    },

    precloseLoan: async (accountId, sourceAccountId, date, description) => {
      const r = await withError(loanInstallmentsSvc.precloseLoan(accountId, sourceAccountId, date, description));
      if (r.data) setData((d) => d && ({
        ...d,
        loanInstallments: d.loanInstallments.map((x) => {
          const updated = r.data.installments.find((i) => i.id === x.id);
          return updated || x;
        }),
        transactions: [...d.transactions, r.data.transaction],
        accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, loanStatus: r.data.loanStatus } : a)),
      }));
    },
  };

  if (dataStatus === "loading") {
    return <SplashScreen />;
  }

  if (dataStatus === "error") {
    return (
      <CenteredScreen>
        <p className="mb-4">{loadError || "Couldn't load your data."}</p>
        <PrimaryButton onClick={loadAll}>
          Try again
        </PrimaryButton>
      </CenteredScreen>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <ErrorBanner message={actionError} onDismiss={() => setActionError("")} />
      <div className={`relative min-h-screen flex font-sans ${theme.app}`}>
        <div className="relative z-10">
          <Sidebar />
        </div>

        <div className="relative z-10 flex-1 min-w-0 flex flex-col">

          <MobileBrandHeader />

          <main className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-10 pb-20 md:pb-8 lg:pb-10">
            <ScrollBounceBoundary>
              {page === "dashboard" && <Dashboard />}
              {page === "transactions" && <TransactionsPage />}
              {page === "accounts" && <AccountsPage />}
              {page === "budget" && <BudgetPage />}
              {page === "bills" && <BillsPage />}
              {page === "invoices" && <InvoicesPage />}
              {page === "goals" && <GoalsPage />}
            </ScrollBounceBoundary>
          </main>

          <MobileNav />
        </div>
      </div>

      {quickAddOpen && (
        <Modal title="Add Transaction" onClose={() => setQuickAddOpen(false)}>
          <TransactionForm existing={null} onDone={() => setQuickAddOpen(false)} />
        </Modal>
      )}
    </AppCtx.Provider>
  );
}

const DEMO_FLAG_KEY = "forge_demo_active_v1";
const DEMO_USER_ID = "demo-user";

function Gate() {
  const { status, user, signOut } = useAuth();
  const [demoActive, setDemoActive] = useState(() => {
    try {
      return sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  });

  const enterDemo = () => {
    try {
      sessionStorage.setItem(DEMO_FLAG_KEY, "1");
    } catch (err) {
      void err;
    }
    setDemoActive(true);
  };

  const exitDemo = () => {
    try {
      sessionStorage.removeItem(DEMO_FLAG_KEY);
    } catch (err) {
      void err;
    }
    demoSvc.resetDemo();
    setDemoActive(false);
  };

  if (demoActive) {
    return <AuthenticatedApp userId={DEMO_USER_ID} onSignOut={exitDemo} isDemoMode onCreateAccount={exitDemo} />;
  }

  if (status === "loading") return <SplashScreen />;
  if (status === "recovery") return <ResetPasswordScreen />;
  if (status === "signed-out") return <AuthGate onExploreDemo={enterDemo} />;

  return (
    <MigrationGate userId={user.id}>
      <AuthenticatedApp userId={user.id} onSignOut={signOut} />
    </MigrationGate>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigError />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}