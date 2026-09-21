import { useState, useMemo, useCallback, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  Card,
  Badge,
  GhostButton,
  PrimaryButton,
  IconBtn,
  Modal,
  EmptyState,
  AppIcon,
  EmiSchedule,
  Select,
} from "../components";

import { TransactionForm } from "../forms/TransactionForm";
import { EmiConvertForm } from "../forms/EmiConvertForm";
import { fmt, monthKey } from "../utils/helpers";
import { sortTransactionsDesc } from "../utils/transactionUtils";

export function TransactionsPage() {
  const { data, theme, deleteTransaction } = useApp();

  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date().toISOString().slice(0, 10)));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [emiModal, setEmiModal] = useState(null);
  const [emiScheduleForId, setEmiScheduleForId] = useState(null);
  const emiScheduleForPlan = data.emiPlans.find((p) => p.id === emiScheduleForId) || null;

  const accountName = useCallback(
    (id) => data.accounts.find((a) => a.id === id)?.name || "—",
    [data.accounts]
  );

  const creditCardAccountIds = useMemo(
    () => new Set(data.accounts.filter((a) => a.type === "Credit Card").map((a) => a.id)),
    [data.accounts]
  );

  const emiPlanByTxnId = useMemo(() => {
    const map = new Map();
    data.emiPlans.forEach((p) => map.set(p.transactionId, p));
    return map;
  }, [data.emiPlans]);

  const finalPaymentTxnIds = useMemo(() => {
    const set = new Set();
    data.bills.forEach((b) => {
      if (b.completed && b.paidTransactionId) set.add(b.paidTransactionId);
    });
    return set;
  }, [data.bills]);

  const isEmiEligible = (t) =>
    t.type === "Expense" && creditCardAccountIds.has(t.account) && !emiPlanByTxnId.has(t.id);

  const remainingInstallments = (planId) =>
    data.emiInstallments.filter((i) => i.emiPlanId === planId && i.status !== "Paid").length;

  const txnIconName = (t) => {
    if (t.type === "Income") return "transactionTypes.income";
    if (t.type === "Transfer") return "transactionTypes.transfer";

    return `categories.${(t.category || "").toLowerCase()}`;
  };

  const confirmDelete = () => {
    deleteTransaction(deleteTarget.id);
    setDeleteTarget(null);
  };

  const availableMonths = useMemo(() => {
    const keys = new Set(data.transactions.map((t) => monthKey(t.date)));
    keys.add(monthKey(new Date().toISOString().slice(0, 10)));
    return [...keys].sort().reverse();
  }, [data.transactions]);

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const monthIndex = availableMonths.indexOf(selectedMonth);
  const goPrevMonth = () => {
    if (monthIndex < availableMonths.length - 1) setSelectedMonth(availableMonths[monthIndex + 1]);
  };
  const goNextMonth = () => {
    if (monthIndex > 0) setSelectedMonth(availableMonths[monthIndex - 1]);
  };

  const filtered = useMemo(() => {
    const list = data.transactions
      .filter((t) => monthKey(t.date) === selectedMonth)
      .filter(
        (t) => typeFilter === "All" || t.type === typeFilter
      )
      .filter(
        (t) => catFilter === "All" || t.category === catFilter
      )
      .filter((t) => {
        const q = search.toLowerCase();

        if (!q) return true;

        return (
          (t.description || "").toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          accountName(t.account).toLowerCase().includes(q)
        );
      });

    return sortTransactionsDesc(list);
  }, [
    data.transactions,
    selectedMonth,
    search,
    typeFilter,
    catFilter,
    accountName,
  ]);

  const allCats = [
    ...new Set(
      data.transactions
        .filter((t) => monthKey(t.date) === selectedMonth)
        .map((t) => t.category)
    ),
  ];

  const exportCsv = () => {
    const header =
      "Date,Type,Category,Description,Account,Amount\n";

    const rows = filtered
      .map(
        (t) =>
          `${t.date},${t.type},${t.category},"${(
            t.description || ""
          ).replace(/"/g, '""')}",${accountName(t.account)},${t.amount}`
      )
      .join("\n");

    const blob = new Blob([header + rows], {
      type: "text/csv",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${selectedMonth}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const filterSelectCls = `
    forge-control
    px-3.5
    py-2.5
    rounded-[14px]
    border
    text-base
    outline-none
    w-auto
    ${theme.input}
  `;

  const periodSelectCls = `forge-control px-2.5 py-1.5 rounded-[10px] border text-[13px] outline-none w-auto min-w-0 truncate ${theme.input}`;

  return (
    <div className="space-y-6 sm:space-y-8">

<div
  className="
    sticky
    top-0
    z-30
    -mx-4
    px-4
    pt-2
    py-3
    bg-content
    border-b
    border-border-subtle
    flex
    flex-col
    gap-3
    sm:flex-row
    sm:flex-wrap
    sm:items-center
    sm:justify-between
  "
>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center flex-1">

          <div className="relative w-full sm:w-auto">
            <AppIcon
              name="ui.search"
              size={14}
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.subtext}`}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className={`
                forge-control
                pl-9
                pr-3.5
                py-2.5
                rounded-[14px]
                border
                text-base
                outline-none
                w-full
                sm:w-56
                ${theme.input}
              `}
            />
          </div>

          <div className="flex items-center gap-2.5">

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`${filterSelectCls} flex-1 sm:flex-none`}
            >
              <option value="All">All</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Transfer">Transfer</option>
            </Select>

            <Select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className={`${filterSelectCls} flex-1 sm:flex-none`}
            >
              <option value="All">All</option>

              {allCats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PrimaryButton onClick={() => setModal("new")} className="flex-1 sm:flex-none justify-center">
            Add Transaction
          </PrimaryButton>

          <GhostButton onClick={exportCsv} title="Export CSV" className="shrink-0 justify-center px-3">
            <AppIcon name="ui.download" size={14} />
          </GhostButton>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <IconBtn
          icon="ui.chevronLeft"
          onClick={goPrevMonth}
          disabled={monthIndex >= availableMonths.length - 1}
          title="Previous month"
        />

        <Select
          value={Number(selectedMonth.split("-")[1]) - 1}
          onChange={(e) => {
            const y = selectedMonth.split("-")[0];
            const key = `${y}-${String(Number(e.target.value) + 1).padStart(2, "0")}`;
            if (availableMonths.includes(key)) setSelectedMonth(key);
          }}
          className={periodSelectCls}
        >
          {Array.from({ length: 12 }, (_, i) => i).map((i) => (
            <option
              key={i}
              value={i}
              disabled={!availableMonths.includes(`${selectedMonth.split("-")[0]}-${String(i + 1).padStart(2, "0")}`)}
            >
              {new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" })}
            </option>
          ))}
        </Select>

        <Select
          value={selectedMonth.split("-")[0]}
          onChange={(e) => {
            const y = e.target.value;
            const m = selectedMonth.split("-")[1];
            const monthsInYear = availableMonths.filter((k) => k.startsWith(y));
            const key = monthsInYear.includes(`${y}-${m}`) ? `${y}-${m}` : monthsInYear[0];
            setSelectedMonth(key);
          }}
          className={periodSelectCls}
        >
          {[...new Set(availableMonths.map((k) => k.split("-")[0]))].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>

        <IconBtn
          icon="ui.chevronRight"
          onClick={goNextMonth}
          disabled={monthIndex <= 0}
          title="Next month"
        />
      </div>

      <div className="md:hidden">
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={(p) => <AppIcon name="dashboard.recent" {...p} />}
              title="No transactions found"
              subtitle="Try adjusting your filters or add a new transaction"
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`forge-card-icon w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                      t.type === "Income" ? "bg-success/10" : "bg-white/5"
                    }`}
                  >
                    <AppIcon
                      name={txnIconName(t)}
                      size={16}
                      className={`forge-card-icon__glyph ${t.type === "Income" ? "text-success" : ""}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="type-body font-medium truncate">{t.description || t.category}</p>
                        <p className={`type-small-label mt-0.5 ${theme.subtext}`}>
                          {t.category} · {t.date}
                        </p>
                      </div>
                      <p
                        className={`text-[16px] font-semibold tracking-[-0.01em] shrink-0 ${
                          t.type === "Income" ? "text-success" : t.type === "Transfer" ? "text-white/55" : "text-danger"
                        }`}
                      >
                        {t.type === "Income" ? "+" : t.type === "Expense" ? "-" : ""}
                        {fmt(t.amount)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 gap-2">
                      <p className={`type-small-label truncate ${theme.subtext}`}>
                        {accountName(t.account)}
                        {t.type === "Transfer" && t.transferAccount ? ` → ${accountName(t.transferAccount)}` : ""}
                        {emiPlanByTxnId.has(t.id) && (
                          <Badge className="!bg-accent/12 !text-accent !border-0 rounded-full px-2 py-0.5 text-[10px] font-normal leading-4 ml-1.5 align-middle">
                            EMI
                          </Badge>
                        )}
                        {finalPaymentTxnIds.has(t.id) && (
                          <Badge className="!bg-success/12 !text-success !border-0 rounded-full px-2 py-0.5 text-[10px] font-normal leading-4 ml-1.5 align-middle">
                            Final Payment
                          </Badge>
                        )}
                      </p>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {isEmiEligible(t) && (
                          <IconBtn icon="ui.emi" onClick={() => setEmiModal(t)} title="Convert to EMI" />
                        )}
                        {emiPlanByTxnId.has(t.id) && (
                          <IconBtn
                            icon="ui.emi"
                            onClick={() => setEmiScheduleForId(emiPlanByTxnId.get(t.id).id)}
                            title="View EMI Schedule"
                          />
                        )}
                        <IconBtn icon="ui.edit" onClick={() => setModal(t)} title="Edit" />
                        <IconBtn icon="ui.delete" danger onClick={() => setDeleteTarget(t)} title="Delete" />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="overflow-hidden hidden md:block">

        {filtered.length === 0 ? (
          <EmptyState
            icon={(p) => (
              <AppIcon
                name="dashboard.recent"
                {...p}
              />
            )}
            title="No transactions found"
            subtitle="Try adjusting your filters or add a new transaction"
          />
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-base">

              <thead>
                <tr className="type-small-label text-left uppercase bg-elevated text-text">

                  <th className="px-6 py-3.5">
                    Date
                  </th>

                  <th className="px-6 py-3.5">
                    Description
                  </th>

                  <th className="px-6 py-3.5">
                    Category
                  </th>

                  <th className="px-6 py-3.5">
                    Account
                  </th>

                  <th className="px-6 py-3.5 text-right">
                    Amount
                  </th>

                  <th className="px-6 py-3.5 text-right">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody className="bg-content">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="
                      forge-row
                      border-b
                      border-border-subtle
                      last:border-0
                    "
                  >

                    <td className="
                      type-small-label
                      px-6
                      py-4
                      whitespace-nowrap
                      text-white/55
                    ">
                      {t.date}
                    </td>

                    <td className="
                      type-body
                      px-6
                      py-4
                      font-medium
                    ">
                      <div className="flex items-center gap-2.5">

                        <AppIcon
                          name={txnIconName(t)}
                          size={14}
                          className="text-white/55"
                        />

                        <span>
                          {t.description || "—"}
                        </span>

                        {emiPlanByTxnId.has(t.id) && (
                          <span title={`${remainingInstallments(emiPlanByTxnId.get(t.id).id)} of ${emiPlanByTxnId.get(t.id).tenureMonths} installments remaining`}>
                            <Badge className="!bg-accent/12 !text-accent !border-0 rounded-full px-2.5 py-0.5 text-[11px] font-normal leading-5 shrink-0">
                              EMI
                            </Badge>
                          </span>
                        )}
                        {finalPaymentTxnIds.has(t.id) && (
                          <Badge className="!bg-success/12 !text-success !border-0 rounded-full px-2.5 py-0.5 text-[11px] font-normal leading-5 shrink-0">
                            Final Payment
                          </Badge>
                        )}

                      </div>
                    </td>

                    <td className="px-6 py-4">
  <Badge
    className="
      !bg-transparent
      !text-white/70
      !border
      !border-border-hover
      rounded-full
      px-2.5
      py-0.5
      text-[11px]
      font-normal
      leading-5
    "
  >
    {t.category}
  </Badge>
</td>

                    <td className="
                      px-6
                      py-4
                      text-white/55
                    ">
                      {accountName(t.account)}

                      {t.type === "Transfer" &&
                        t.transferAccount
                        ? ` → ${accountName(
                            t.transferAccount
                          )}`
                        : ""}

                      {t.type === "Transfer" &&
                        creditCardAccountIds.has(t.transferAccount) && (
                          <span className="block type-small-label text-accent mt-0.5">
                            Credit Card Payment
                          </span>
                        )}
                    </td>

                    <td
                      className={`
                        type-body
                        px-6
                        py-4
                        text-right
                        font-semibold
                        whitespace-nowrap
                        ${
                          t.type === "Income"
                            ? "text-success"
                            : t.type === "Transfer"
                              ? "text-white/55"
                              : "text-danger"
                        }
                      `}
                    >
                      {t.type === "Income"
                        ? "+"
                        : t.type === "Expense"
                          ? "-"
                          : ""}

                      {fmt(t.amount)}
                    </td>

                    <td className="px-6 py-4">

                      <div className="
                        flex
                        items-center
                        justify-end
                        gap-1
                      ">

                        {isEmiEligible(t) && (
                          <IconBtn
                            icon="ui.emi"
                            onClick={() => setEmiModal(t)}
                            title="Convert to EMI"
                          />
                        )}

                        {emiPlanByTxnId.has(t.id) && (
                          <IconBtn
                            icon="ui.emi"
                            onClick={() => setEmiScheduleForId(emiPlanByTxnId.get(t.id).id)}
                            title="View EMI Schedule"
                          />
                        )}

                        <IconBtn
                          icon="ui.edit"
                          onClick={() => setModal(t)}
                          title="Edit"
                        />

                        <IconBtn
                          icon="ui.delete"
                          danger
                          onClick={() =>
                            setDeleteTarget(t)
                          }
                          title="Delete"
                        />

                      </div>

                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}
      </Card>

      {modal && (
        <Modal
          title={
            modal === "new"
              ? "Add Transaction"
              : "Edit Transaction"
          }
          onClose={() => setModal(null)}
        >
          <TransactionForm
            existing={modal === "new" ? null : modal}
            onDone={() => setModal(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Transaction"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex items-start gap-3 mb-5">

            <AppIcon
              name="ui.warning"
              size={18}
              className="text-warning shrink-0 mt-0.5"
            />

            <p className={`type-secondary ${theme.subtext}`}>
              Are you sure you want to delete{" "}
              <strong>
                {deleteTarget.description ||
                  deleteTarget.category}
              </strong>
              ? This cannot be undone.
            </p>

          </div>

          <div className="flex items-center gap-3">

            <GhostButton
              className="flex-1 justify-center"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </GhostButton>

            <PrimaryButton
              className="flex-1 justify-center !bg-danger hover:!bg-danger/85"
              onClick={confirmDelete}
            >
              Delete Transaction
            </PrimaryButton>

          </div>
        </Modal>
      )}

      {emiModal && (
        <Modal
          title={`Convert "${emiModal.description || emiModal.category}" to EMI`}
          onClose={() => setEmiModal(null)}
        >
          <EmiConvertForm
            transaction={emiModal}
            onDone={() => setEmiModal(null)}
          />
        </Modal>
      )}

      {emiScheduleForPlan && (
        <Modal
          title="EMI Schedule"
          onClose={() => setEmiScheduleForId(null)}
          wide
        >
          <EmiSchedule
            plan={emiScheduleForPlan}
            onDone={() => setEmiScheduleForId(null)}
          />
        </Modal>
      )}
    </div>
  );
}