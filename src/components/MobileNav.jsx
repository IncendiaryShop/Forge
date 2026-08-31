import { useState } from "react";
import { useApp } from "../context/AppContext";
import { NAV, MOBILE_NAV_MORE } from "../utils/constants";
import { computeBillStatus } from "../utils/billCycle";
import { AppIcon } from "./AppIcon";
import { Modal } from "./Modal";

const navById = Object.fromEntries(
  NAV.map((item) => [item.id, item])
);

/* -------------------------------------------------------------------------
   Mobile bottom navigation — Dashboard | Transactions | Accounts | Recurring | More.

   The navigation is displayed as a floating rounded pill near the bottom
   of the screen.

   Desktop navigation is unaffected because this component is md:hidden.
------------------------------------------------------------------------- */

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
      <span
        className={`relative flex items-center justify-center w-13 h-11 rounded-full transition-all duration-200 ${
          active
            ? "bg-accent text-white"
            : "text-white/50"
        }`}
      >
        <AppIcon
          name={item.icon}
          size={18}
        />
      </span>

      {badge > 0 && !active && (
        <span
          className="
            absolute
            top-1.5
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
      {/* -----------------------------------------------------------------
          Floating mobile navigation.

          left-4 / right-4 gives the floating navigation the same general
          horizontal inset as the mobile page content.

          bottom-6 controls the distance from the bottom of the viewport.
      ----------------------------------------------------------------- */}
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
        <div className="relative w-full max-w-md mx-auto">

          {/* ---------------------------------------------------------------
              Floating navigation pill
          --------------------------------------------------------------- */}
          <div
            className="
              relative
              flex
              items-stretch
              w-full
              h-[56px]
              rounded-full
              bg-elevated
              border
              border-white/[0.06]
              backdrop-blur-xl
              shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5)]
            "
          >
            {/* Dashboard */}
            <NavButton
              item={navById["dashboard"]}
              active={page === "dashboard"}
              onClick={() => goTo("dashboard")}
            />

            {/* Transactions */}
            <NavButton
              item={navById["transactions"]}
              active={page === "transactions"}
              onClick={() => goTo("transactions")}
            />

            {/* Accounts */}
            <NavButton
              item={navById["accounts"]}
              active={page === "accounts"}
              onClick={() => goTo("accounts")}
            />

            {/* Recurring */}
            <NavButton
              item={navById["bills"]}
              active={page === "bills"}
              onClick={() => goTo("bills")}
              badge={billsDueSoon}
            />

            {/* More */}
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
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 ${
                  moreIsActive
                    ? "bg-accent text-white"
                    : "text-white/50"
                }`}
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

      {/* -------------------------------------------------------------------
          More sheet
      ------------------------------------------------------------------- */}
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
                  className={`w-full flex items-center gap-3 px-4 h-12 rounded-[14px] transition-colors duration-150 ${
                    active
                      ? "bg-accent/12 text-accent"
                      : "text-text hover:bg-white/[0.04]"
                  }`}
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

            {/* Sign out */}
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
                  border-white/[0.06]
                  pt-3.5
                "
              >
                <AppIcon
                  name="ui.signOut"
                  size={17}
                />

                <span className="flex-1 text-left text-[15px] font-medium">
                  Sign out
                </span>
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}