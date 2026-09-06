import { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Card,
  PrimaryButton,
  GhostButton,
  IconBtn,
  ProgressBar,
  Modal,
  EmptyState,
  AppIcon,
} from "../components";
import { BudgetForm } from "../forms/BudgetForm";
import { fmt, monthKey, todayISO } from "../utils/helpers";

const CATEGORY_STYLES = {
  Food: {
    icon: "categories.food",
    color: "text-text",
    bg: "bg-white/[0.16]",
    border: "border-white/[0.22]",
    progress: "bg-accent",
  },
  Groceries: {
    icon: "categories.groceries",
    color: "text-text",
    bg: "bg-white/[0.13]",
    border: "border-white/[0.18]",
    progress: "bg-accent",
  },
  Transportation: {
    icon: "categories.transportation",
    color: "text-text",
    bg: "bg-white/10",
    border: "border-border-hover",
    progress: "bg-accent",
  },
  Shopping: {
    icon: "categories.shopping",
    color: "text-text",
    bg: "bg-white/[0.08]",
    border: "border-white/[0.12]",
    progress: "bg-accent",
  },
  Entertainment: {
    icon: "categories.entertainment",
    color: "text-text",
    bg: "bg-white/[0.06]",
    border: "border-border",
    progress: "bg-accent",
  },
  Utilities: {
    icon: "categories.utilities",
    color: "text-text",
    bg: "bg-white/[0.05]",
    border: "border-border",
    progress: "bg-accent",
  },
  Fuel: {
    icon: "categories.fuel",
    color: "text-text",
    bg: "bg-accent/15",
    border: "border-accent/20",
    progress: "bg-accent",
  },
};

const FALLBACK_STYLE = {
  icon: "categories.shopping",
  color: "text-accent",
  bg: "bg-accent/10",
  border: "border-accent/20",
  progress: "bg-accent",
};

export function BudgetPage() {
  const { data, theme, removeBudget } = useApp();
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const thisMonth = todayISO().slice(0, 7);

  const monthTxns = data.transactions.filter(
    (t) => monthKey(t.date) === thisMonth && t.type === "Expense"
  );

  const rows = Object.entries(data.budgets).map(([category, amount]) => {
    const spent = monthTxns
      .filter((t) => t.category === category)
      .reduce((s, t) => s + Number(t.amount), 0);

    return {
      category,
      amount: Number(amount),
      spent,
      pct: amount > 0 ? (spent / amount) * 100 : 0,
    };
  });

  const totalBudget = rows.reduce((s, r) => s + r.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  const totalPct =
    totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const confirmDelete = () => {
    removeBudget(deleteTarget.category);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">

      <div className="flex justify-end w-full">
  <PrimaryButton onClick={() => setModal("new")}>
    Set Budget
  </PrimaryButton>
</div>

      <Card className="p-5 sm:p-6 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <p className={`type-card-label ${theme.subtext}`}>
              Total Monthly Budget
            </p>

            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight">
                {fmt(totalSpent)}
              </span>

              <span className={`type-secondary ${theme.subtext}`}>
                of {fmt(totalBudget)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <AppIcon
                name="dashboard.budget"
                size={20}
                className="text-accent"
              />
            </div>

            <div>
              <p className="text-xl font-bold leading-none">
                {Math.round(totalPct)}%
              </p>

              <p className={`type-small-label mt-1 ${theme.subtext}`}>
                of budget used
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <ProgressBar
            pct={totalPct}
            colorClass={
              totalSpent > totalBudget ? "bg-danger" : "bg-accent"
            }
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-7">
          <EmptyState
            icon={(p) => (
              <AppIcon name="dashboard.budget" {...p} />
            )}
            title="No budgets set"
            subtitle="Set a monthly budget for a category to start tracking"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 w-full">
          {rows.map((r) => {
            const over = r.spent > r.amount;
            const style =
              CATEGORY_STYLES[r.category] || FALLBACK_STYLE;

            const progressColor = over
              ? "bg-danger"
              : r.pct > 80
                ? "bg-warning"
                : style.progress;

            const remaining = Math.max(r.amount - r.spent, 0);

            return (
              <Card
                key={r.category}
                className="p-5 group transition-all duration-200 hover:border-border"
              >

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full ${style.bg} border ${style.border} flex items-center justify-center shrink-0`}
                    >
                      <AppIcon
                        name={style.icon}
                        size={19}
                        className={style.color}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="type-body font-semibold truncate">
                        {r.category}
                      </p>

                      <p
                        className={`type-secondary mt-0.5 ${theme.subtext}`}
                      >
                        {fmt(r.spent)} of {fmt(r.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg bg-white/[0.06] text-xs font-semibold ${
                        over ? "text-danger" : ""
                      }`}
                    >
                      {Math.round(r.pct)}%
                    </span>

                    <div className="forge-card-actions flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <IconBtn
                        icon="ui.edit"
                        title="Edit"
                        onClick={() =>
                          setModal({
                            category: r.category,
                            amount: r.amount,
                          })
                        }
                      />

                      <IconBtn
                        icon="ui.delete"
                        danger
                        title="Delete"
                        onClick={() => setDeleteTarget(r)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <ProgressBar
                    pct={r.pct}
                    colorClass={progressColor}
                  />
                </div>

                <div className="flex items-center justify-between mt-3">
                  <p
                    className={`type-secondary font-medium ${
                      over ? "text-danger" : style.color
                    }`}
                  >
                    {over
                      ? `Over by ${fmt(r.spent - r.amount)}`
                      : `${fmt(r.spent)} used`}
                  </p>

                  {!over && (
                    <p className={`type-secondary ${theme.subtext}`}>
                      {fmt(remaining)} left
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal
          title={
            modal === "new"
              ? "Set Category Budget"
              : `Edit ${modal.category} Budget`
          }
          onClose={() => setModal(null)}
        >
          <BudgetForm
            category={modal === "new" ? null : modal.category}
            currentAmount={modal === "new" ? null : modal.amount}
            onDone={() => setModal(null)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Budget"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="flex items-start gap-3 mb-5">
            <AppIcon
              name="ui.warning"
              size={18}
              className="text-warning shrink-0 mt-0.5"
            />

            <p className={`type-secondary ${theme.subtext}`}>
              Are you sure you want to delete the{" "}
              <strong>{deleteTarget.category}</strong> budget? This
              cannot be undone.
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
              Delete Budget
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
