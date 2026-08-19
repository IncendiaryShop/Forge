import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Card, PrimaryButton, GhostButton, IconBtn, Modal, AccountLogo, AppIcon, ProgressBar, LoanSchedule } from "../components";
import { AccountForm } from "../forms/AccountForm";
import { LoanDisburseForm } from "../forms/LoanDisburseForm";
import { fmt } from "../utils/helpers";
import { currentBillingCycle } from "../utils/creditCardBilling";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(date) {
  if (!date) return null;
  return `${date.getDate()} ${MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`;
}

function CreditCardStats({ account, outstanding, theme, statements, onGenerateStatement }) {
  const limit = Number(account.creditLimit) || 0;
  const available = limit - outstanding;
  const pct = limit > 0 ? (outstanding / limit) * 100 : 0;
  const overLimit = limit > 0 && outstanding > limit;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cycle = currentBillingCycle(account, today);
  const latestStatement = cycle
    ? statements.filter((s) => s.accountId === account.id).sort((a, b) => b.cycleKey.localeCompare(a.cycleKey))[0]
    : null;
  const cycleAlreadyGenerated = cycle && latestStatement?.cycleKey === cycle.cycleKey;

  return (
    <div className="mt-3">
      <p className={`type-display-number ${overLimit ? "text-red-500" : ""}`}>
        {fmt(outstanding)} <span className={`type-secondary font-normal ${theme.subtext}`}>used</span>
      </p>
      {limit > 0 ? (
        <>
          <p className={`type-secondary mt-1 ${overLimit ? "text-red-500" : theme.subtext}`}>
            {fmt(Math.max(available, 0))} available of {fmt(limit)} limit
          </p>
          <div className="mt-3">
            <ProgressBar pct={pct} colorClass={overLimit ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-accent"} />
          </div>
        </>
      ) : (
        <p className="type-secondary text-amber-400 mt-1">No credit limit set</p>
      )}

      {cycle && (
        <div className={`mt-4 pt-4 border-t ${theme.rowBorder}`}>
          <p className={`type-small-label ${theme.subtext}`}>
            Statement {formatDate(cycle.statementDate)}{cycle.dueDate ? ` · Due ${formatDate(cycle.dueDate)}` : ""}
          </p>
          {latestStatement && cycleAlreadyGenerated ? (
            <p className="type-secondary mt-1">
              Statement balance: <span className="font-semibold">{fmt(latestStatement.statementBalance)}</span>
            </p>
          ) : (
            <GhostButton className="mt-2 !py-1.5 !px-3 text-[13px]" onClick={() => onGenerateStatement(account, cycle)}>
              Generate Statement
            </GhostButton>
          )}
        </div>
      )}
    </div>
  );
}

function LoanStats({ account, outstanding, theme, isDisbursed, onDisburse, onViewSchedule }) {
  const pct = account.opening > 0 ? ((account.opening - outstanding) / account.opening) * 100 : 0;

  return (
    <div className="mt-3">
      <p className="type-display-number">
        {fmt(outstanding)} <span className={`type-secondary font-normal ${theme.subtext}`}>outstanding</span>
      </p>
      <p className={`type-secondary mt-1 ${theme.subtext}`}>
        of {fmt(account.opening)} original principal
      </p>
      {isDisbursed && (
        <div className="mt-3">
          <ProgressBar pct={pct} colorClass="bg-accent" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className={`type-small-label ${theme.subtext}`}>EMI</p>
          <p className="type-body font-semibold mt-0.5">{fmt(account.loanEmiAmount)}</p>
        </div>
        <div>
          <p className={`type-small-label ${theme.subtext}`}>Interest Rate</p>
          <p className="type-body font-semibold mt-0.5">{account.loanInterestRate}% p.a.</p>
        </div>
      </div>
      <div className={`mt-4 pt-4 border-t ${theme.rowBorder}`}>
        {isDisbursed ? (
          <GhostButton className="w-full justify-center" onClick={onViewSchedule}>View Schedule</GhostButton>
        ) : (
          <PrimaryButton className="w-full justify-center" onClick={onDisburse}>Disburse Loan</PrimaryButton>
        )}
      </div>
    </div>
  );
}

export function AccountsPage() {
  const { data, theme, accountBalance, accountOutstanding, loanOutstandingPrincipal, deleteAccount, generateStatement } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { account, refCount } | null
  const [disburseTarget, setDisburseTarget] = useState(null); // loan account | null
  const [loanScheduleForId, setLoanScheduleForId] = useState(null); // loan account id | null

  const referenceCount = (accountId) =>
    data.transactions.filter(t => t.account === accountId || t.transferAccount === accountId).length;

  const requestDelete = (account) => {
    setDeleteTarget({ account, refCount: referenceCount(account.id) });
  };

  const confirmDelete = () => {
    if (deleteTarget.refCount > 0) return;
    deleteAccount(deleteTarget.account.id);
    setDeleteTarget(null);
  };

  const handleGenerateStatement = (account, cycle) => {
    // Local Y-M-D formatting, not toISOString() — cycle.statementDate/dueDate
    // are local-midnight Date objects (from clampedDueDate), and
    // toISOString() converts to UTC first, which can shift the calendar day
    // backward for positive UTC offsets. This must stay exact for a billing
    // date.
    const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    generateStatement(account.id, cycle.cycleKey, toLocalISO(cycle.statementDate), cycle.dueDate ? toLocalISO(cycle.dueDate) : null);
  };

  const loanScheduleForAccount = data.accounts.find((a) => a.id === loanScheduleForId) || null;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setModal("new")}><AppIcon name="ui.add" size={15} /> Add Account</PrimaryButton>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.accounts.map(a => {
          const isCreditCard = a.type === "Credit Card";
          const isLoan = a.type === "Loan";
          const bal = accountBalance(a.id);
          const isDisbursed = isLoan && data.loanInstallments.some((i) => i.accountId === a.id);
          return (
            <Card key={a.id} className="p-7 relative group">
              <div className="flex items-start justify-between">
                <AccountLogo account={a} size="md" />
                <div className="forge-card-actions flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <IconBtn icon="ui.edit" onClick={() => setModal(a)} title="Edit" />
                  <IconBtn icon="ui.delete" danger onClick={() => requestDelete(a)} title="Delete" />
                </div>
              </div>
              <p className="type-body font-semibold mt-4">{a.name}</p>
              <p className={`type-secondary ${theme.subtext}`}>{a.type}</p>
              {isCreditCard ? (
                <CreditCardStats
                  account={a}
                  outstanding={accountOutstanding(a.id)}
                  theme={theme}
                  statements={data.creditCardStatements}
                  onGenerateStatement={handleGenerateStatement}
                />
              ) : isLoan ? (
                <LoanStats
                  account={a}
                  outstanding={loanOutstandingPrincipal(a.id)}
                  theme={theme}
                  isDisbursed={isDisbursed}
                  onDisburse={() => setDisburseTarget(a)}
                  onViewSchedule={() => setLoanScheduleForId(a.id)}
                />
              ) : (
                <p className={`type-display-number mt-3 ${bal < 0 ? "text-red-500" : ""}`}>{fmt(bal)}</p>
              )}
            </Card>
          );
        })}
      </div>
      {modal && (
        <Modal title={modal === "new" ? "Add Account" : "Edit Account"} onClose={() => setModal(null)}>
          <AccountForm existing={modal === "new" ? null : modal} onDone={() => setModal(null)} />
        </Modal>
      )}
      {disburseTarget && (
        <Modal title={`Disburse "${disburseTarget.name}"`} onClose={() => setDisburseTarget(null)}>
          <LoanDisburseForm account={disburseTarget} onDone={() => setDisburseTarget(null)} />
        </Modal>
      )}
      {loanScheduleForAccount && (
        <Modal title="Loan Schedule" onClose={() => setLoanScheduleForId(null)} wide>
          <LoanSchedule account={loanScheduleForAccount} onDone={() => setLoanScheduleForId(null)} />
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="Delete Account" onClose={() => setDeleteTarget(null)}>
          <div className="flex items-start gap-3 mb-5">
            <AppIcon name="ui.warning" size={18} className="text-amber-400 shrink-0 mt-0.5" />
            {deleteTarget.refCount > 0 ? (
              <p className={`type-secondary ${theme.subtext}`}>
                <strong>{deleteTarget.account.name}</strong> is referenced by {deleteTarget.refCount} transaction{deleteTarget.refCount === 1 ? "" : "s"}. Deleting it would leave those transactions pointing at a missing account, so deletion is blocked. Reassign or remove those transactions first.
              </p>
            ) : (
              <p className={`type-secondary ${theme.subtext}`}>
                Are you sure you want to delete <strong>{deleteTarget.account.name}</strong>? This cannot be undone.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <GhostButton className="flex-1 justify-center" onClick={() => setDeleteTarget(null)}>
              {deleteTarget.refCount > 0 ? "Close" : "Cancel"}
            </GhostButton>
            {deleteTarget.refCount === 0 && (
              <PrimaryButton className="flex-1 justify-center !bg-red-500 hover:!bg-red-600" onClick={confirmDelete}>
                Delete Account
              </PrimaryButton>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}