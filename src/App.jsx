import { useState, useEffect, useCallback, useRef } from "react";
import MoltenMetal from "./components/MoltenMetal";
import { AppCtx } from "./context/AppContext";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthCtx";
import { theme } from "./styles/theme";
import { PAGE_TITLES } from "./utils/constants";
import { getActiveBillingCycle } from "./utils/billCycle";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { ConfigError } from "./components/ConfigError";
import { AuthGate } from "./components/AuthGate";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";
import { MigrationGate } from "./components/MigrationGate";
import { Sidebar } from "./components/Sidebar";
import { MobileNav } from "./components/MobileNav";
import { Dashboard } from "./pages/Dashboard";
import { TransactionsPage } from "./pages/TransactionsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { BudgetPage } from "./pages/BudgetPage";
import { BillsPage } from "./pages/BillsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { GoalsPage } from "./pages/GoalsPage";

import * as accountsSvc from "./services/accounts";
import * as txnSvc from "./services/transactions";
import * as budgetsSvc from "./services/budgets";
import * as billsSvc from "./services/bills";
import * as invoicesSvc from "./services/invoices";
import * as goalsSvc from "./services/goals";

/* --------------------------------- Shell --------------------------------- */

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

/* ----------------------------- Authenticated app ----------------------------- */
/* Everything below only ever mounts once we have a signed-in user and the
   one-time local->cloud migration (if any) is resolved — see MigrationGate. */

function AuthenticatedApp({ userId, onSignOut }) {
  const [data, setData] = useState(null);
  const [dataStatus, setDataStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState("dashboard");
  const channelsRef = useRef([]);

  const loadAll = useCallback(async () => {
    setDataStatus("loading");
    const [accounts, transactions, budgets, bills, invoices, goals] = await Promise.all([
      accountsSvc.listAccounts(),
      txnSvc.listTransactions(),
      budgetsSvc.listBudgets(),
      billsSvc.listBills(),
      invoicesSvc.listInvoices(),
      goalsSvc.listGoals(),
    ]);
    const failed = [accounts, transactions, budgets, bills, invoices, goals].find((r) => r.error);
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
    });
    setDataStatus("ready");
  }, []);

  useEffect(() => {
    document.title = `${PAGE_TITLES[page]} • Forge`;
  }, [page]);

  useEffect(() => {
    queueMicrotask(loadAll);
  }, [loadAll, userId]);

  // Realtime: one channel per user-owned table, filtered server-side to this
  // user's rows (RLS applies to realtime too, so this filter is belt-and-
  // braces, not the actual security boundary). On any INSERT/UPDATE/DELETE we
  // simply refetch that table — simplest correct approach for this first
  // migration pass; a finer-grained patch-in-place could follow later.
  // Cleaned up on unmount and whenever userId changes so a sign-out/sign-in
  // (or React StrictMode's double-invoke in dev) can never leave a duplicate
  // subscription running.
  useEffect(() => {
    const tables = [
      { name: "accounts", refetch: accountsSvc.listAccounts, key: "accounts" },
      { name: "transactions", refetch: txnSvc.listTransactions, key: "transactions" },
      { name: "budgets", refetch: budgetsSvc.listBudgets, key: "budgets" },
      { name: "bills", refetch: billsSvc.listBills, key: "bills" },
      { name: "invoices", refetch: invoicesSvc.listInvoices, key: "invoices" },
      { name: "goals", refetch: goalsSvc.listGoals, key: "goals" },
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
  }, [userId]);

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

  // Every mutating context function funnels through here so failures always
  // surface the same way (a dismissible banner) instead of failing silently —
  // required by section 10 of the migration brief. Success is applied
  // directly from the row the server returned, rather than waiting for the
  // realtime echo to arrive (which still arrives shortly after and is a
  // harmless no-op re-set of the same data).
  const withError = async (promise) => {
    const result = await promise;
    if (result?.error) setActionError(result.error.message);
    return result;
  };

  const ctx = {
    data: data ? {
      ...data,
      // Expose `paid` derived from each bill's active billing cycle so every
      // page reads the correct per-cycle status without knowing about
      // paidCycle itself — unchanged from the pre-Supabase behavior.
      bills: data.bills.map((b) => ({ ...b, paid: b.paidCycle === getActiveBillingCycle(b, startOfToday()) })),
    } : data,
    dataStatus,
    theme,
    page,
    setPage,
    accountBalance,
    userId,
    signOut: onSignOut,
    reload: loadAll,

    addTransaction: async (t) => {
      const r = await withError(txnSvc.createTransaction(userId, t));
      if (r.data) setData((d) => d && ({ ...d, transactions: [...d.transactions, r.data] }));
    },
    updateTransaction: async (id, t) => {
      const r = await withError(txnSvc.updateTransaction(id, t));
      if (r.data) setData((d) => d && ({ ...d, transactions: d.transactions.map((x) => (x.id === id ? r.data : x)) }));
    },
    deleteTransaction: async (id) => {
      const bill = data?.bills.find((b) => b.paidTransactionId === id);
      const r = await withError(txnSvc.deleteTransaction(id));
      if (r.error) return;
      // Mirror the pre-Supabase behavior: deleting a bill's linked payment
      // transaction also clears that bill's paid state for the cycle. The DB
      // FK (ON DELETE SET NULL) already nulls bills.paid_transaction_id on
      // its own; unpayBill additionally clears paid_cycle to match — its own
      // "delete the linked transaction" step is a safe no-op here since it's
      // already gone.
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
      const dateStr = new Date().toISOString().slice(0, 10);
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
      const resolvedDate = paymentDate || new Date().toISOString().slice(0, 10);
      const r = await withError(invoicesSvc.payInvoice(userId, invoice, resolvedAccount, resolvedDate));
      if (r.data) setData((d) => d && ({
        ...d,
        invoices: d.invoices.map((x) => (x.id === id ? r.data.invoice : x)),
        transactions: [...d.transactions, r.data.transaction],
      }));
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
  };

  if (dataStatus === "loading") {
    return <CenteredScreen>Loading your dashboard…</CenteredScreen>;
  }

  if (dataStatus === "error") {
    return (
      <CenteredScreen>
        <p className="mb-4">{loadError || "Couldn't load your data."}</p>
        <button
          type="button"
          onClick={loadAll}
          className="forge-button type-button inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-[14px]"
        >
          Try again
        </button>
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
          <main className="flex-1 w-full p-8 lg:p-10">
            {page === "dashboard" && <Dashboard />}
            {page === "transactions" && <TransactionsPage />}
            {page === "accounts" && <AccountsPage />}
            {page === "budget" && <BudgetPage />}
            {page === "bills" && <BillsPage />}
            {page === "invoices" && <InvoicesPage />}
            {page === "goals" && <GoalsPage />}
          </main>

          <MobileNav />
        </div>
      </div>
    </AppCtx.Provider>
  );
}

/* --------------------------------- Gate --------------------------------- */

function Gate() {
  const { status, user, signOut } = useAuth();

  if (status === "loading") return <CenteredScreen>Checking your session…</CenteredScreen>;
  if (status === "recovery") return <ResetPasswordScreen />;
  if (status === "signed-out") return <AuthGate />;

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