import { useState, useMemo, useCallback } from "react";
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
} from "../components";

import { TransactionForm } from "../forms/TransactionForm";
import { EmiConvertForm } from "../forms/EmiConvertForm";
import { hashColorClasses, fmt } from "../utils/helpers";
import { sortTransactionsDesc } from "../utils/transactionUtils";

export function TransactionsPage() {
  const { data, theme, deleteTransaction } = useApp();

  const [modal, setModal] = useState(null); // 'new' | txn object | null
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [emiModal, setEmiModal] = useState(null); // transaction being converted | null
  const [emiScheduleForId, setEmiScheduleForId] = useState(null); // emi plan id | null
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

  const filtered = useMemo(() => {
    const list = data.transactions
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
    search,
    typeFilter,
    catFilter,
    accountName,
  ]);

  const allCats = [
    ...new Set(data.transactions.map((t) => t.category)),
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
    a.download = "transactions.csv";
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

  return (
    <div className="space-y-8">

      {/* ================= Filters / Actions ================= */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">

          {/* Search */}
          <div className="relative">
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
                w-56
                ${theme.input}
              `}
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={filterSelectCls}
          >
            <option value="All">All</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>

          {/* Category Filter */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className={filterSelectCls}
          >
            <option value="All">All</option>

            {allCats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <GhostButton onClick={exportCsv}>
            <AppIcon name="ui.download" size={14} />
            Export CSV
          </GhostButton>

          <PrimaryButton onClick={() => setModal("new")}>
            <AppIcon name="ui.add" size={15} />
            Add Transaction
          </PrimaryButton>
        </div>
      </div>

      {/* ================= Transactions Table ================= */}
      <Card className="overflow-hidden">

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

              {/* ================= Table Header ================= */}
              <thead>
                <tr className="type-small-label text-left uppercase bg-[#262626] text-[#EFEFEF]">

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

              {/* ================= Table Body ================= */}
              <tbody className="bg-[#0c0c0c]">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="
                      forge-row
                      border-b
                      border-white/[0.06]
                      last:border-0
                    "
                  >

                    {/* Date */}
                    <td className="
                      type-small-label
                      px-6
                      py-4
                      whitespace-nowrap
                      text-white/55
                    ">
                      {t.date}
                    </td>

                    {/* Description */}
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

                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
  <Badge
    className="
      !bg-transparent
      !text-white/70
      !border
      !border-white/15
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

                    {/* Account */}
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

                    {/* Amount */}
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
                            ? "text-emerald-500"
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

                    {/* Actions */}
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

      {/* ================= Add / Edit Modal ================= */}
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

      {/* ================= Delete Modal ================= */}
      {deleteTarget && (
        <Modal
          title="Delete Transaction"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex items-start gap-3 mb-5">

            <AppIcon
              name="ui.warning"
              size={18}
              className="text-amber-400 shrink-0 mt-0.5"
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
              className="flex-1 justify-center !bg-red-500 hover:!bg-red-600"
              onClick={confirmDelete}
            >
              Delete Transaction
            </PrimaryButton>

          </div>
        </Modal>
      )}

      {/* ================= Convert to EMI Modal ================= */}
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

      {/* ================= EMI Schedule Modal ================= */}
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