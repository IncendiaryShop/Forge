import ForgeLogo from "../assets/forge_logo.svg";
import { useApp } from "../context/AppContext";
import { NAV } from "../utils/constants";
import { computeBillStatus } from "../utils/billCycle";
import { AppIcon } from "./AppIcon";

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
      className="
        sticky
        top-0
        h-screen
        w-[240px]
        shrink-0
        flex
        flex-col
        bg-[#0e0e0e]
        border-r
        border-white/[0.06]
        hidden
        md:flex
      "
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
              className={`forge-sidebar-nav type-button w-full flex items-center gap-3 px-4 h-11 rounded-[8px] transition-all duration-200 ease-out border ${
  active
    ? "bg-[#9366E9] border-transparent text-[#171717]"
    : "border-transparent text-white hover:bg-white/[0.04] hover:border-transparent hover:text-white"
}`}
            >
              <AppIcon
                name={item.icon}
                size={15}
              />

              <span className="flex-1 text-left text-[15px] font-normal tracking-[-0.01em]">
                {item.label}
              </span>

              {item.id === "bills" &&
  billsDueSoon > 0 &&
  !active && (
    <span
      className="
        min-w-[20px]
        h-[20px]
        px-1.5
        flex
        items-center
        justify-center
        rounded-full
        bg-white/[0.7]
        border
        border-white/[0.10]
        text-[#171717]
        text-[11px]
        font-mono
      "
    >
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
            className="
              forge-sidebar-nav
              type-button
              w-full
              flex
              items-center
              gap-3
              px-4
              h-11
              rounded-2xl
              border
              border-transparent
              text-white
              hover:bg-white/[0.04]
              hover:border-white/[0.06]
              hover:text-white
              transition-all
              duration-200
              ease-out
            "
          >
            <AppIcon
              name="ui.signOut"
              size={15}
            />

            <span className="flex-1 text-left text-[15px] font-normal tracking-[-0.01em]">
              Sign out
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
