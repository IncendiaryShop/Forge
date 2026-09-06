import { useState } from "react";
import { useApp } from "../context/AppContext";
import { NAV, MOBILE_NAV_MORE } from "../utils/constants";
import { computeBillStatus } from "../utils/billCycle";
import { AppIcon } from "./AppIcon";
import { Modal } from "./Modal";
import GlassCard from "./GlassCard";

const navById = Object.fromEntries(
  NAV.map((item) => [item.id, item])
);

function NavButton({ item, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className="
        relative
        flex
        items-center
        justify-center
        flex-1
        h-full
        min-w-0
        px-1
      "
    >
      {active ? (
  <GlassCard
    className="
      glass-card--active
      flex
      items-center
      justify-center
      w-[78%]
      h-[calc(100%-16px)]
      rounded-full
      text-white
    "
  >
    <span className="relative z-10 flex items-center justify-center">
      <AppIcon name={item.icon} size={18} />
    </span>
  </GlassCard>
) : (
  <span
    className="
      flex
      items-center
      justify-center
      w-[78%]
      h-[calc(100%-16px)]
      rounded-full
      text-white/50
    "
  >
    <AppIcon name={item.icon} size={18} />
  </span>
)}

      {badge > 0 && !active && (
        <span
          className="
            absolute
            top-[calc(50%-24px)]
            right-[calc(50%-19px)]
            min-w-[16px]
            h-4
            px-1
            flex
            items-center
            justify-center
            rounded-full
            bg-accent
            text-[10px]
            font-bold
            text-white
            leading-none
            ring-2
            ring-elevated
          "
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function MobileNav() {
  const {
    page,
    setPage,
    signOut,
    data,
    isDemoMode,
    resetDemo,
    onCreateAccount,
  } = useApp();

  const [moreOpen, setMoreOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const billsDueSoon = (data?.bills || []).filter((b) => {
    if (b.paid) return false;

    const { daysOut, overdue } = computeBillStatus(
      b,
      today
    );

    return (
      overdue ||
      (daysOut >= 0 && daysOut <= 5)
    );
  }).length;

  const goTo = (id) => {
    setPage(id);
    setMoreOpen(false);
  };

  const moreIsActive =
    MOBILE_NAV_MORE.includes(page);

  return (
    <>

      <nav
        className="
          md:hidden
          fixed
          left-4
          right-4
          bottom-4
          z-40
        "
      >
        <div className="relative w-full">

          <div
            className="
              relative
              flex
              items-stretch
              w-full
              h-[clamp(52px,15vw,60px)]
              rounded-full
              bg-elevated
              border
              border-border-subtle
              backdrop-blur-xl
              shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5)]
            "
          >

            <NavButton
              item={navById["dashboard"]}
              active={page === "dashboard"}
              onClick={() => goTo("dashboard")}
            />

            <NavButton
              item={navById["transactions"]}
              active={page === "transactions"}
              onClick={() => goTo("transactions")}
            />

            <NavButton
              item={navById["accounts"]}
              active={page === "accounts"}
              onClick={() => goTo("accounts")}
            />

            <NavButton
              item={navById["bills"]}
              active={page === "bills"}
              onClick={() => goTo("bills")}
              badge={billsDueSoon}
            />

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More"
              aria-current={
                moreIsActive ? "page" : undefined
              }
              className="
                relative
                flex
                items-center
                justify-center
                flex-1
                h-full
                min-w-0
                px-1
              "
            >
              <span
                className={`
                  relative
                  flex
                  items-center
                  justify-center
                  w-[78%]
                  h-[calc(100%-16px)]
                  rounded-full
                  transition-all
                  duration-200
                  ${
                    moreIsActive
                      ? "bg-accent text-bg"
                      : "text-white/50"
                  }
                `}
              >
                <AppIcon
                  name="ui.more"
                  size={18}
                />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {moreOpen && (
        <Modal
          title="More"
          onClose={() => setMoreOpen(false)}
        >
          <div className="space-y-1.5">
            {MOBILE_NAV_MORE.map((id) => {
              const item = navById[id];
              const active = page === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTo(id)}
                  className={`
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    h-12
                    rounded-[14px]
                    transition-colors
                    duration-150
                    ${
                      active
                        ? "bg-accent/12 text-accent"
                        : "text-text hover:bg-white/[0.04]"
                    }
                  `}
                >
                  <AppIcon
                    name={item.icon}
                    size={17}
                  />

                  <span className="flex-1 text-left text-[15px] font-medium">
                    {item.label}
                  </span>

                  {id === "bills" &&
                    billsDueSoon > 0 && (
                      <span
                        className="
                          min-w-[22px]
                          h-[22px]
                          px-1.5
                          flex
                          items-center
                          justify-center
                          rounded-full
                          bg-accent/15
                          text-accent
                          text-[11px]
                          font-mono
                        "
                      >
                        {billsDueSoon}
                      </span>
                    )}

                  <AppIcon
                    name="ui.chevronRight"
                    size={14}
                    className="opacity-40"
                  />
                </button>
              );
            })}

            {isDemoMode && (
              <div className="mt-2 border-t border-border-subtle pt-3.5 space-y-2">

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    resetDemo?.();
                  }}
                  className="w-full flex items-center justify-center h-11 rounded-[14px] border border-border text-text/80 hover:bg-white/[0.04] transition-colors duration-150"
                >
                  <span className="text-[14px] font-medium">Reset Demo</span>
                </button>
                {onCreateAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onCreateAccount();
                    }}
                    className="w-full flex items-center justify-center h-11 rounded-[14px] bg-accent text-bg hover:bg-accent-hover transition-colors duration-150"
                  >
                    <span className="text-[14px] font-semibold">Create free account</span>
                  </button>
                )}
              </div>
            )}

            {signOut && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                }}
                className="
                  w-full
                  flex
                  items-center
                  gap-3
                  px-4
                  h-12
                  rounded-[14px]
                  text-text
                  hover:bg-white/[0.04]
                  transition-colors
                  duration-150
                  mt-2
                  border-t
                  border-border-subtle
                  pt-3.5
                "
              >
                <AppIcon
                  name="ui.signOut"
                  size={17}
                />

                <span className="flex-1 text-left text-[15px] font-medium">
                  {isDemoMode ? "Exit Demo" : "Sign out"}
                </span>
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
