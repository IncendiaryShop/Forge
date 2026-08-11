import { useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  AlertTriangle, ChevronRight, Info, Landmark,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Card, Kpi, EmptyState, ProgressBar, ServiceLogo, AppIcon } from "../components";
import { CHART_COLORS } from "../utils/constants";
import { fmt, monthKey, todayISO } from "../utils/helpers";
import { computeBillStatus, statusLabel, badgeFor } from "../utils/billCycle";
import { sortTransactionsDesc, relativeDate } from "../utils/transactionUtils";

const tooltipStyle = {
  background: "#1E1E29",
  border: "1px solid rgba(245,245,247,0.08)",
  borderRadius: 14,
  fontSize: 13,
  fontFamily: "Manrope",
  color: "#F5F5F7",
  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function parseYM(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 };
}

function buildMonthlyPeriods(endYear, endMonth) {
  const periods = [];

  for (let i = 5; i >= 0; i--) {
    let m = endMonth - i;
    let y = endYear;

    while (m < 0) {
      m += 12;
      y -= 1;
    }

    periods.push({
      year: y,
      month: m,
      label: `${MONTH_NAMES[m].slice(0, 3)} ${y}`
    });
  }

  return periods;
}

function buildQuarterlyPeriods(endYear, endQuarter) {
  const periods = [];

  for (let i = 3; i >= 0; i--) {
    let q = endQuarter - i;
    let y = endYear;

    while (q < 1) {
      q += 4;
      y -= 1;
    }

    periods.push({
      year: y,
      quarter: q,
      label: `Q${q} ${y}`
    });
  }

  return periods;
}

function buildYearlyPeriods(endYear) {
  const periods = [];

  for (let i = 4; i >= 0; i--) {
    periods.push({
      year: endYear - i,
      label: `${endYear - i}`
    });
  }

  return periods;
}

function niceCeil(value) {
  if (value <= 0) return 0;

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);

  let niceFraction;

  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * Math.pow(10, exponent);
}

function formatINRCompact(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 100000) {
    return `${sign}₹${Math.round((abs / 100000) * 10) / 10}L`;
  }

  if (abs >= 1000) {
    return `${sign}₹${Math.round((abs / 1000) * 10) / 10}k`;
  }

  return `${sign}₹${Math.round(abs)}`;
}

function CashFlowTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const income =
    payload.find((p) => p.dataKey === "Income")?.value ?? 0;

  const expenses =
    payload.find((p) => p.dataKey === "Expenses")?.value ?? 0;

  const net =
    payload.find((p) => p.dataKey === "Net Cash Flow")?.value ?? 0;

  return (
    <div style={tooltipStyle} className="p-3.5 min-w-[160px]">
      <p className="font-semibold mb-2">{label}</p>

      <div className="flex items-center justify-between gap-6">
        <span className="opacity-70">Income</span>
        <span>{fmt(income)}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mt-1">
        <span className="opacity-70">Expenses</span>
        <span>{fmt(expenses)}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mt-1">
        <span className="opacity-70">Net Cash Flow</span>
        <span>{fmt(net)}</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, theme, accountBalance, setPage } = useApp();
  const { transactions, accounts, budgets } = data;

  const thisMonth = todayISO().slice(0, 7);

  const getBillIcon = (bill) => {
    const text = `${bill.name || ""} ${bill.category || ""}`.toLowerCase();

    if (text.includes("electric")) return "bills.electricity";
    if (text.includes("water")) return "bills.water";
    if (text.includes("gas")) return "bills.gas";
    if (text.includes("internet") || text.includes("wifi")) return "bills.internet";
    if (text.includes("phone") || text.includes("mobile")) return "bills.phone";
    if (text.includes("rent")) return "bills.rent";
    if (text.includes("insurance")) return "bills.insurance";
    if (text.includes("loan") || text.includes("emi")) return "bills.loan";

    return "bills.bill";
  };

  const monthTxns = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === thisMonth),
    [transactions, thisMonth]
  );

  const income = monthTxns
    .filter((t) => t.type === "Income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expense = monthTxns
    .filter((t) => t.type === "Expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalBalance = accounts.reduce(
    (s, a) => s + accountBalance(a.id),
    0
  );

  const budgetTotal = Object.values(budgets).reduce(
    (s, v) => s + Number(v),
    0
  );

  const budgetSpent = Object.keys(budgets).reduce(
    (s, cat) =>
      s +
      monthTxns
        .filter(
          (t) => t.type === "Expense" && t.category === cat
        )
        .reduce((a, t) => a + Number(t.amount), 0),
    0
  );

  const budgetRemaining = budgetTotal - budgetSpent;

  const categorySpend = useMemo(() => {
    const map = {};

    monthTxns
      .filter((t) => t.type === "Expense")
      .forEach((t) => {
        map[t.category] =
          (map[t.category] || 0) + Number(t.amount);
      });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  const [periodType, setPeriodType] = useState("monthly");

  const [monthSel, setMonthSel] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const [quarterSel, setQuarterSel] = useState({
    quarter: Math.floor(new Date().getMonth() / 3) + 1,
    year: new Date().getFullYear()
  });

  const [yearSel, setYearSel] = useState(
    new Date().getFullYear()
  );

  const handlePeriodTypeChange = (val) => {
    setPeriodType(val);

    const now = new Date();

    if (val === "monthly") {
      setMonthSel({
        month: now.getMonth(),
        year: now.getFullYear()
      });
    }

    if (val === "quarterly") {
      setQuarterSel({
        quarter: Math.floor(now.getMonth() / 3) + 1,
        year: now.getFullYear()
      });
    }

    if (val === "yearly") {
      setYearSel(now.getFullYear());
    }
  };

  const currentYear = new Date().getFullYear();

  const earliestYear = useMemo(() => {
    let min = currentYear;

    transactions.forEach((t) => {
      const y = parseInt(t.date.slice(0, 4), 10);

      if (!Number.isNaN(y) && y < min) {
        min = y;
      }
    });

    return min;
  }, [transactions, currentYear]);

  const yearOptions = useMemo(() => {
    const arr = [];

    for (let y = currentYear; y >= earliestYear; y--) {
      arr.push(y);
    }

    return arr;
  }, [earliestYear, currentYear]);

  const monthlyBuckets = useMemo(() => {
    const map = new Map();

    transactions.forEach((t) => {
      const { year, month } = parseYM(t.date);
      const key = `${year}-${month}`;

      const entry =
        map.get(key) || {
          income: 0,
          expenses: 0
        };

      if (t.type === "Income") {
        entry.income += Number(t.amount);
      } else if (t.type === "Expense") {
        entry.expenses += Number(t.amount);
      }

      map.set(key, entry);
    });

    return map;
  }, [transactions]);

  const getMonthAgg = useCallback(
    (year, month) =>
      monthlyBuckets.get(`${year}-${month}`) || {
        income: 0,
        expenses: 0
      },
    [monthlyBuckets]
  );

  const cashFlowData = useMemo(() => {
    if (periodType === "monthly") {
      return buildMonthlyPeriods(
        monthSel.year,
        monthSel.month
      ).map((p) => {
        const { income, expenses } = getMonthAgg(
          p.year,
          p.month
        );

        return {
          label: p.label,
          Income: income,
          Expenses: expenses,
          "Net Cash Flow": income - expenses
        };
      });
    }

    if (periodType === "quarterly") {
      return buildQuarterlyPeriods(
        quarterSel.year,
        quarterSel.quarter
      ).map((p) => {
        let income = 0;
        let expenses = 0;

        const startMonth = (p.quarter - 1) * 3;

        for (
          let m = startMonth;
          m < startMonth + 3;
          m++
        ) {
          const agg = getMonthAgg(p.year, m);

          income += agg.income;
          expenses += agg.expenses;
        }

        return {
          label: p.label,
          Income: income,
          Expenses: expenses,
          "Net Cash Flow": income - expenses
        };
      });
    }

    return buildYearlyPeriods(yearSel).map((p) => {
      let income = 0;
      let expenses = 0;

      for (let m = 0; m < 12; m++) {
        const agg = getMonthAgg(p.year, m);

        income += agg.income;
        expenses += agg.expenses;
      }

      return {
        label: p.label,
        Income: income,
        Expenses: expenses,
        "Net Cash Flow": income - expenses
      };
    });
  }, [
    periodType,
    monthSel,
    quarterSel,
    yearSel,
    getMonthAgg
  ]);

  const { yDomainMin, yDomainMax } = useMemo(() => {
    let maxAbs = 0;
    let minVal = 0;

    cashFlowData.forEach((d) => {
      maxAbs = Math.max(
        maxAbs,
        Math.abs(d.Income),
        Math.abs(d.Expenses),
        Math.abs(d["Net Cash Flow"])
      );

      minVal = Math.min(
        minVal,
        d["Net Cash Flow"]
      );
    });

    const top =
      maxAbs > 0
        ? niceCeil(maxAbs * 1.15)
        : 100;

    const bottom =
      minVal < 0
        ? -niceCeil(Math.abs(minVal) * 1.15)
        : 0;

    return {
      yDomainMin: bottom,
      yDomainMax: top
    };
  }, [cashFlowData]);

  const selectCls = `forge-control px-2.5 py-1.5 rounded-[10px] border text-[13px] outline-none w-auto ${theme.input}`;

  const recent = sortTransactionsDesc(transactions).slice(0, 5);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingPayments = data.bills
    .filter((bill) => !bill.paid)
    .map((bill) => {
      const { daysOut, overdue } =
        computeBillStatus(bill, today);

      return {
        ...bill,
        daysOut,
        overdue
      };
    })
    .filter(
      (bill) =>
        bill.overdue ||
        (bill.daysOut >= 0 && bill.daysOut <= 5)
    )
    .sort((a, b) => {
      const rankA = a.overdue
        ? a.daysOut - 1000
        : a.daysOut;

      const rankB = b.overdue
        ? b.daysOut - 1000
        : b.daysOut;

      return rankA - rankB;
    })
    .slice(0, 3);

  const invoiceSummary = useMemo(() => {
    const summary = {
      unpaid: {
        count: 0,
        amount: 0
      },
      paid: {
        count: 0,
        amount: 0
      }
    };

    (data.invoices || []).forEach((inv) => {
      const amt = Number(inv.amount);

      if (inv.status === "Paid") {
        summary.paid.count += 1;
        summary.paid.amount += amt;
      } else {
        summary.unpaid.count += 1;
        summary.unpaid.amount += amt;
      }
    });

    const totalCount =
      (data.invoices || []).length;

    return {
      ...summary,
      totalCount
    };
  }, [data.invoices]);

  return (
    <div className="grid grid-cols-12 gap-5 items-start">

      <div className="col-span-12 lg:col-span-9 space-y-5 min-w-0">

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          <Kpi
            label="Total Balance"
            value={fmt(totalBalance)}
            icon={(p) => (
              <AppIcon
                name="dashboard.balance"
                {...p}
              />
            )}
            sub="Updated from linked accounts"
            compact
          />

          <Kpi
            label="Earning Overview"
            value={fmt(income)}
            icon={(p) => (
              <AppIcon
                name="dashboard.earnings"
                {...p}
              />
            )}
            trend="up"
            sub="This month"
            compact
          />

          <Kpi
            label="Spending Overview"
            value={fmt(expense)}
            icon={(p) => (
              <AppIcon
                name="dashboard.spending"
                {...p}
              />
            )}
            trend="down"
            sub="This month"
            compact
          />

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] gap-4 items-stretch">

          <Card className="p-8 min-w-0">

            <div className="flex items-center justify-between mb-1 flex-wrap gap-3">

              {/* Cash Flow heading + hover info */}
              <div className="group relative flex items-center gap-1.5">

                <h3 className="type-section-title">
                  Cash Flow
                </h3>

                <span className="relative flex items-center">

                  <Info
                    size={13}
                    className="cursor-help text-white/40 transition-colors group-hover:text-white/80"
                  />

                  <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 translate-y-1 rounded-xl border border-white/[0.08] bg-[#151519]/95 p-4 opacity-0 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">

                    <span className="block text-[13px] font-semibold text-white mb-1.5">
                      What is Net Cash Flow?
                    </span>

                    <span className={`block text-[12px] leading-5 ${theme.subtext}`}>
                      Income minus Expenses. This shows your actual activity for the selected period.
                    </span>

                  </span>

                </span>

              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">

                <select
                  value={periodType}
                  onChange={(e) =>
                    handlePeriodTypeChange(
                      e.target.value
                    )
                  }
                  className={selectCls}
                >
                  <option value="monthly">
                    Monthly
                  </option>

                  <option value="quarterly">
                    Quarterly
                  </option>

                  <option value="yearly">
                    Yearly
                  </option>
                </select>

                {periodType === "monthly" && (
                  <>
                    <select
                      value={monthSel.month}
                      onChange={(e) =>
                        setMonthSel((s) => ({
                          ...s,
                          month: Number(
                            e.target.value
                          )
                        }))
                      }
                      className={selectCls}
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option
                          key={i}
                          value={i}
                        >
                          {m}
                        </option>
                      ))}
                    </select>

                    <select
                      value={monthSel.year}
                      onChange={(e) =>
                        setMonthSel((s) => ({
                          ...s,
                          year: Number(
                            e.target.value
                          )
                        }))
                      }
                      className={selectCls}
                    >
                      {yearOptions.map((y) => (
                        <option
                          key={y}
                          value={y}
                        >
                          {y}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {periodType === "quarterly" && (
                  <>
                    <select
                      value={quarterSel.quarter}
                      onChange={(e) =>
                        setQuarterSel((s) => ({
                          ...s,
                          quarter: Number(
                            e.target.value
                          )
                        }))
                      }
                      className={selectCls}
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <option
                          key={q}
                          value={q}
                        >
                          {`Q${q}`}
                        </option>
                      ))}
                    </select>

                    <select
                      value={quarterSel.year}
                      onChange={(e) =>
                        setQuarterSel((s) => ({
                          ...s,
                          year: Number(
                            e.target.value
                          )
                        }))
                      }
                      className={selectCls}
                    >
                      {yearOptions.map((y) => (
                        <option
                          key={y}
                          value={y}
                        >
                          {y}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {periodType === "yearly" && (
                  <select
                    value={yearSel}
                    onChange={(e) =>
                      setYearSel(
                        Number(e.target.value)
                      )
                    }
                    className={selectCls}
                  >
                    {yearOptions.map((y) => (
                      <option
                        key={y}
                        value={y}
                      >
                        {y}
                      </option>
                    ))}
                  </select>
                )}

              </div>

            </div>

            <p className={`type-small-label mb-7 ${theme.subtext}`}>
              See your actual cash flow activity this month.
            </p>

            <div className="flex flex-col lg:flex-row gap-6 items-stretch">

              <div className="h-80 flex-1 min-w-0">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <ComposedChart
                    data={cashFlowData}
                    barGap={6}
                    margin={{
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: -8
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="2 4"
                      stroke="rgba(245,245,247,0.04)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 12,
                        fill: "#808080",
                        fontFamily: "Manrope"
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      domain={[
                        yDomainMin,
                        yDomainMax
                      ]}
                      allowDecimals={false}
                      tick={{
                        fontSize: 11,
                        fill: "#808080",
                        fontFamily: "Manrope"
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={
                        formatINRCompact
                      }
                    />

                    <Tooltip
                      content={
                        <CashFlowTooltip />
                      }
                      cursor={{
                        fill: "rgba(245,245,247,0.03)"
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                        fontFamily: "Manrope",
                        paddingTop: 8
                      }}
                    />

                    <Bar
                      dataKey="Income"
                      fill="#22c55e"
                      radius={[6, 6, 0, 0]}
                      barSize={18}
                    />

                    <Bar
                      dataKey="Expenses"
                      fill="#7C6CF3"
                      radius={[6, 6, 0, 0]}
                      barSize={18}
                    />

                    <Line
                      type="monotone"
                      dataKey="Net Cash Flow"
                      stroke="#F5A524"
                      strokeWidth={2.5}
                      dot={{
                        r: 3,
                        fill: "#F5A524",
                        strokeWidth: 0
                      }}
                      activeDot={{ r: 5 }}
                    />

                  </ComposedChart>
                </ResponsiveContainer>

              </div>

            </div>

          </Card>

          <Card className="p-8 min-w-0">

            <div className="flex items-center justify-between mb-4">

              <h3 className="type-section-title">
                Invoices
              </h3>

              <button
                onClick={() =>
                  setPage("invoices")
                }
                className="forge-link type-button text-accent flex items-center gap-0.5 hover:gap-1"
              >
                View all
                <ChevronRight size={13} />
              </button>

            </div>

            {invoiceSummary.totalCount === 0 ? (

              <EmptyState
                icon={(p) => (
                  <AppIcon
                    name="dashboard.invoices"
                    {...p}
                  />
                )}
                title="No invoices yet"
                subtitle="Add an invoice to start tracking payments"
              />

            ) : (

              <div className="space-y-3">

                <button
                  onClick={() =>
                    setPage("invoices")
                  }
                  className="group w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/10"
                >

                  <div className="flex items-center gap-3.5">

                    <div className="forge-card-icon w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-rose-500/15">

                      <AppIcon
                        name="invoiceStates.unpaid"
                        size={17}
                        className="forge-card-icon__glyph text-rose-400"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className={`type-small-label ${theme.subtext}`}>
                        {invoiceSummary.unpaid.count} Unpaid
                      </p>

                      <p className="text-[22px] font-extrabold tracking-[-0.01em] text-rose-400 mt-0.5">
                        {fmt(
                          invoiceSummary.unpaid.amount
                        )}
                      </p>

                    </div>

                    <ChevronRight
                      size={16}
                      className="shrink-0 opacity-40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-80"
                    />

                  </div>

                  <p className={`type-small-label mt-2.5 ${theme.subtext}`}>
                    Amount due from unpaid invoices
                  </p>

                </button>

                <button
                  onClick={() =>
                    setPage("invoices")
                  }
                  className="group w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/10"
                >

                  <div className="flex items-center gap-3.5">

                    <div className="forge-card-icon w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15">

                      <AppIcon
                        name="invoiceStates.paid"
                        size={17}
                        className="forge-card-icon__glyph text-emerald-400"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className={`type-small-label ${theme.subtext}`}>
                        {invoiceSummary.paid.count} Paid
                      </p>

                      <p className="text-[22px] font-extrabold tracking-[-0.01em] text-emerald-400 mt-0.5">
                        {fmt(
                          invoiceSummary.paid.amount
                        )}
                      </p>

                    </div>

                    <ChevronRight
                      size={16}
                      className="shrink-0 opacity-40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-80"
                    />

                  </div>

                  <p className={`type-small-label mt-2.5 ${theme.subtext}`}>
                    Amount received from paid invoices
                  </p>

                </button>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">

                  <div className="flex items-center gap-3.5">

                    <div className="forge-card-icon w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-white/[0.08]">

                      <AppIcon
                        name="invoiceStates.invoice"
                        size={17}
                        className="forge-card-icon__glyph"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className={`type-small-label ${theme.subtext}`}>
                        Total Invoices
                      </p>

                      <p className="text-[22px] font-extrabold tracking-[-0.01em] mt-0.5">
                        {invoiceSummary.totalCount}
                      </p>

                    </div>

                  </div>

                  <p className={`type-small-label mt-2.5 ${theme.subtext}`}>
                    All time invoices
                  </p>

                </div>

              </div>

            )}

          </Card>

        </div>

        <Card className="p-8">

          <div className="flex items-center justify-between mb-6">

            <h3 className="type-section-title">
              Recent Transactions
            </h3>

            <button
              onClick={() =>
                setPage("transactions")
              }
              className="forge-link type-button text-accent flex items-center gap-0.5 hover:gap-1"
            >
              View all
              <ChevronRight size={13} />
            </button>

          </div>

          {recent.length === 0 ? (

            <EmptyState
              icon={(p) => (
                <AppIcon
                  name="dashboard.recent"
                  {...p}
                />
              )}
              title="No transactions yet"
              subtitle="Add your first transaction to get started"
            />

          ) : (

            <div className="space-y-1">

              {recent.map((t) => (

                <div
                  key={t.id}
                  className={`flex items-center justify-between py-2.5 border-b last:border-0 ${theme.rowBorder}`}
                >

                  <div className="flex items-center gap-4 min-w-0">

                    <div
                      className={`forge-card-icon w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${
                        t.type === "Income"
                          ? "bg-emerald-500/10"
                          : "bg-white/5"
                      }`}
                    >

                      <AppIcon
                        name={
                          t.type === "Income"
                            ? "transactionTypes.income"
                            : t.type === "Transfer"
                              ? "transactionTypes.transfer"
                              : "transactionTypes.expense"
                        }
                        size={14}
                        className={`forge-card-icon__glyph ${
                          t.type === "Income"
                            ? "text-emerald-500"
                            : ""
                        }`}
                      />

                    </div>

                    <div className="min-w-0">

                      <p className="type-body truncate">
                        {t.description ||
                          t.category}
                      </p>

                      <p className={`type-small-label mt-0.5 opacity-80 ${theme.subtext}`}>
                        {t.category} ·{" "}
                        {relativeDate(t.date)}
                      </p>

                    </div>

                  </div>

                  <p
                    className={`text-[17px] font-extrabold tracking-[-0.01em] shrink-0 ${
                      t.type === "Income"
                        ? "text-emerald-500"
                        : ""
                    }`}
                  >
                    {t.type === "Income"
                      ? "+"
                      : "-"}
                    {fmt(t.amount)}
                  </p>

                </div>

              ))}

            </div>

          )}

        </Card>

      </div>

      <div className="col-span-12 lg:col-span-3 space-y-5 min-w-0">

        <Card className="p-5">

          <h3 className="type-section-title mb-4">
            Upcoming Payments
          </h3>

          {upcomingPayments.length === 0 ? (

            <>
              <EmptyState
                icon={(p) => (
                  <AppIcon
                    name="dashboard.upcoming"
                    {...p}
                  />
                )}
                title="No upcoming payments"
                subtitle="Nothing due in the next 5 days."
              />

              <button
                onClick={() =>
                  setPage("bills")
                }
                className="forge-link type-button w-full text-center rounded-xl h-[42px] flex items-center justify-center border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 mt-4"
              >
                Manage Bills
              </button>
            </>

          ) : (

            <>

              <div className="space-y-1.5">

                {upcomingPayments.map((p) => {

                  const badge = badgeFor(p);

                  return (

                    <div
                      key={p.id}
                      onClick={() =>
                        setPage("bills")
                      }
                      className="group cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
                    >

                      <div className="flex items-center justify-between mb-1.5">

                        <div className="flex items-center gap-3 min-w-0">

                          {p.provider ? (

                            <ServiceLogo
                              provider={p.provider}
                              size="widget"
                            />

                          ) : (

                            <AppIcon
                              name={getBillIcon(p)}
                              size="md"
                              container
                            />

                          )}

                          <div className="min-w-0">

                            <p className="text-[15px] font-bold truncate">
                              {p.name}
                            </p>

                          </div>

                        </div>

                        <span
                          className={`text-[11px] font-bold leading-none px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>

                      </div>

                      <div className="flex items-center justify-between pl-[46px]">

                        <p className={`type-small-label ${theme.subtext}`}>
                          {statusLabel(p)}
                        </p>

                        <p className="text-[16px] font-extrabold tracking-[-0.01em]">
                          {fmt(p.amount)}
                        </p>

                      </div>

                    </div>

                  );

                })}

              </div>

              <div
                className={`border-t mt-3 pt-3 ${theme.rowBorder}`}
              >

                <button
                  onClick={() =>
                    setPage("bills")
                  }
                  className="forge-link type-button w-full text-center rounded-xl h-[42px] flex items-center justify-center border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200"
                >
                  View All
                </button>

              </div>

            </>

          )}

        </Card>

        <Card className="p-5">

          <h3 className="type-section-title mb-5">
            Spending Breakdown
          </h3>

          {categorySpend.length === 0 ? (

            <EmptyState
              icon={(p) => (
                <AppIcon
                  name="dashboard.breakdown"
                  {...p}
                />
              )}
              title="No expenses yet"
              subtitle="Add a transaction to see the breakdown"
            />

          ) : (

            <>

              <div className="relative h-48">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <PieChart
                    margin={{
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0
                    }}
                  >

                    <Pie
                      data={categorySpend}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={94}
                      paddingAngle={3}
                      cornerRadius={4}
                    >

                      {categorySpend.map(
                        (_, i) => (
                          <Cell
                            key={i}
                            fill={
                              CHART_COLORS[
                                i %
                                  CHART_COLORS.length
                              ]
                            }
                            stroke="none"
                          />
                        )
                      )}

                    </Pie>

                    <Tooltip
                      formatter={(v) =>
                        fmt(v)
                      }
                      contentStyle={
                        tooltipStyle
                      }
                    />

                  </PieChart>

                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

                  <p
                    className={`type-small-label ${theme.subtext}`}
                  >
                    Total Spent
                  </p>

                  <p className="text-[15px] font-extrabold tracking-[-0.01em]">
                    {fmt(
                      categorySpend.reduce(
                        (s, c) =>
                          s + c.value,
                        0
                      )
                    )}
                  </p>

                </div>

              </div>

              <div className="space-y-2.5 mt-5">

                {categorySpend
                  .slice(0, 4)
                  .map((c, i) => {

                    const total =
                      categorySpend.reduce(
                        (s, x) =>
                          s + x.value,
                        0
                      );

                    const pct =
                      total > 0
                        ? Math.round(
                            (c.value /
                              total) *
                              100
                          )
                        : 0;

                    return (

                      <div
                        key={c.name}
                        className="flex items-center justify-between gap-3"
                      >

                        <div className="flex items-center gap-2.5 min-w-0">

                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                CHART_COLORS[
                                  i %
                                    CHART_COLORS.length
                                ]
                            }}
                          />

                          <p className="type-body truncate">
                            {c.name}
                          </p>

                        </div>

                        <div className="flex items-center gap-2 shrink-0">

                          <span
                            className={`type-small-label ${theme.subtext}`}
                          >
                            {pct}%
                          </span>

                          <span className="type-body font-bold">
                            {fmt(c.value)}
                          </span>

                        </div>

                      </div>

                    );

                  })}

              </div>

            </>

          )}

        </Card>

        <Card className="p-5">

          <h3 className="type-section-title mb-4">
            Budget Remaining
          </h3>

          <p className={`type-small-label ${theme.subtext}`}>
            Remaining
          </p>

          <p className="type-display-number mt-1">
            {fmt(
              Math.max(
                0,
                budgetRemaining
              )
            )}
          </p>

          <div className="mt-4">

            <ProgressBar
              pct={
                budgetTotal > 0
                  ? (budgetSpent /
                      budgetTotal) *
                    100
                  : 0
              }
              colorClass={
                budgetSpent >
                budgetTotal
                  ? "bg-red-500"
                  : "bg-accent"
              }
            />

            <p
              className={`type-small-label mt-1.5 text-right ${theme.subtext}`}
            >
              {budgetTotal > 0
                ? Math.round(
                    (budgetSpent /
                      budgetTotal) *
                      100
                  )
                : 0}
              % used
            </p>

          </div>

          <div
            className={`grid grid-cols-2 gap-3 mt-4 pt-4 border-t ${theme.rowBorder}`}
          >

            <div>

              <p
                className={`type-small-label ${theme.subtext}`}
              >
                Spent
              </p>

              <p className="type-body font-bold mt-0.5">
                {fmt(budgetSpent)}
              </p>

            </div>

            <div>

              <p
                className={`type-small-label ${theme.subtext}`}
              >
                Budget
              </p>

              <p className="type-body font-bold mt-0.5">
                {fmt(budgetTotal)}
              </p>

            </div>

          </div>

          {budgetSpent >
            budgetTotal &&
            budgetTotal > 0 && (

              <p className="type-secondary text-red-500 mt-3 flex items-center gap-1">
                <AlertTriangle
                  size={12}
                />
                Over budget this month
              </p>

            )}

          <button
            onClick={() =>
              setPage("budget")
            }
            className="forge-link type-button text-accent flex items-center gap-0.5 mt-5 hover:gap-1"
          >
            Manage budget
            <ChevronRight
              size={13}
            />
          </button>

        </Card>

      </div>

    </div>
  );
}