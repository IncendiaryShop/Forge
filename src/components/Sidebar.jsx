import ForgeLogo from "../assets/forge_logo.svg";
import { LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import { NAV } from "../utils/constants";
import { computeBillStatus } from "../utils/billCycle";
import { AppIcon } from "./AppIcon";

const NAV_ICON = {
  dashboard: "dashboard.home",
  transactions: "dashboard.recent",
  accounts: "accountTypes.bank",
  budget: "dashboard.budget",
  bills: "bills.subscription",
  invoices: "dashboard.invoices",
  goals: "goals.savings",
};

export function Sidebar() {
  const { theme, page, setPage, data, signOut } = useApp();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billsDueSoon = data.bills.filter((b) => {
    if (b.paid) return false;
    const { daysOut, overdue } = computeBillStatus(b, today);
    return overdue || (daysOut >= 0 && daysOut <= 5);
  }).length;

  return (
    <aside
  className={`sticky top-0 h-screen w-[240px] shrink-0 border-r border-white/5 flex flex-col ${theme.sidebar} hidden md:flex`}
>
      {/* ================= Brand ================= */}
      <div className="px-6 pt-8 pb-7 flex justify-center">
        <img
          src={ForgeLogo}
          alt="Forge"
          className="w-37.5 h-auto select-none"
          draggable={false}
        />
      </div>

      {/* ================= Navigation ================= */}
      <nav className="flex-1 px-3 py-3 space-y-3">
        {NAV.map((item) => {
          const active = page === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              aria-current={active ? "page" : undefined}
              className={`forge-sidebar-nav type-button w-full flex items-center gap-3 px-4 h-11 rounded-2xl transition-all duration-200 ease-out border ${
                active
                  ? "bg-accent/10 border-accent/20 text-accent shadow-[0_0_24px_rgba(101,120,200,0.18)]"
                  : `border-transparent ${theme.subtext} hover:bg-white/[0.03] hover:border-white/10 hover:text-text hover:-translate-y-[1px] hover:shadow-[0_10px_25px_rgba(0,0,0,0.25)]`
              }`}
            >
              <AppIcon name={NAV_ICON[item.id]} size={15} strokeWidth={1.8} />

              <span className="flex-1 text-left text-[15px] font-medium tracking-[-0.01em]">
                {item.label}
              </span>

              {item.id === "bills" &&
                billsDueSoon > 0 &&
                !active && (
                  <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-accent/15 text-accent text-[10px] font-semibold">
                    {billsDueSoon}
                  </span>
                )}
            </button>
          );
        })}
      </nav>

      {/* ================= Sign out ================= */}
      {signOut && (
        <div className="px-3 pb-6 pt-2">
          <button
            type="button"
            onClick={signOut}
            className={`forge-sidebar-nav type-button w-full flex items-center gap-3 px-4 h-11 rounded-2xl border border-transparent ${theme.subtext} hover:bg-white/[0.03] hover:border-white/10 hover:text-text transition-all duration-200 ease-out`}
          >
            <LogOut size={15} strokeWidth={1.8} />
            <span className="flex-1 text-left text-[15px] font-medium tracking-[-0.01em]">Sign out</span>
          </button>
        </div>
      )}
    </aside>
  );
}