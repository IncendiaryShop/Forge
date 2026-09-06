import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import { AppIcon } from "./AppIcon";
import { todayISO } from "../utils/helpers";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISO(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseISO(str) {
  if (!str || typeof str !== "string") return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function formatDisplay(str) {
  const p = parseISO(str);
  if (!p) return "";
  return new Date(p.year, p.month, p.day).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function DatePicker({ value, onChange, required, disabled, className = "", placeholder = "Select date" }) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);
  const todayStr = todayISO();
  const today = new Date();

  const parsed = parseISO(value);
  const [viewYear, setViewYear] = useState(parsed ? parsed.year : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.month : today.getMonth());
  const sheetRef = useRef(null);

  const openPicker = () => {
    if (disabled) return;
    const p = parseISO(value);
    setViewYear(p ? p.year : today.getFullYear());
    setViewMonth(p ? p.month : today.getMonth());
    setOpen(true);
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    sheetRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const selectDay = (d) => {
    const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
    onChange({ target: { value: iso } });
    close();
  };

  const grid = buildMonthGrid(viewYear, viewMonth);
  const displayLabel = formatDisplay(value);

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        required={required}
        className={`
          forge-control w-full px-3.5 py-2.5 rounded-[14px] border text-base outline-none
          flex items-center justify-between gap-2 text-left
          disabled:opacity-50 disabled:cursor-not-allowed
          ${theme.input} ${className}
        `}
      >
        <span className={`truncate ${displayLabel ? "" : theme.subtext}`}>
          {displayLabel || placeholder}
        </span>
        <AppIcon name="ui.calendar" size={15} className={`shrink-0 ${theme.subtext}`} />
      </button>

      {open && createPortal(
        <div
          className={`fixed inset-0 z-[70] flex items-center justify-center p-4 ${theme.modalOverlay}`}
          onClick={close}
          data-no-rubber-band
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose date"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className={`forge-modal w-full max-w-[300px] rounded-[20px] border ${theme.card} p-4 shadow-xl shadow-black/30 outline-none`}
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className={`forge-button flex items-center justify-center w-8 h-8 rounded-[10px] ${theme.hover}`}
              >
                <AppIcon name="ui.chevronLeft" size={13} />
              </button>

              <p className="type-body font-semibold">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </p>

              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className={`forge-button flex items-center justify-center w-8 h-8 rounded-[10px] ${theme.hover}`}
              >
                <AppIcon name="ui.chevronRight" size={13} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((w, i) => (
                <div key={i} className={`text-center text-[11px] font-medium py-1 ${theme.subtext}`}>
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === viewMonth;
                const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate());
                const isSelected = iso === value;
                const isToday = iso === todayStr;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(d)}
                    aria-current={isToday ? "date" : undefined}
                    aria-selected={isSelected}
                    className={`
                      aspect-square rounded-[10px] text-[13px] flex items-center justify-center
                      transition-colors duration-150
                      ${isSelected
                        ? "bg-accent text-bg font-semibold"
                        : inMonth
                          ? `text-text ${theme.hover}`
                          : `${theme.faint} ${theme.hover}`}
                      ${isToday && !isSelected ? "ring-1 ring-inset ring-accent/60" : ""}
                    `}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => selectDay(today)}
              className={`forge-link type-button text-accent w-full text-center mt-3 pt-3 border-t ${theme.rowBorder} hover:opacity-80`}
            >
              Today
            </button>

            {!required && value && (
              <button
                type="button"
                onClick={() => {
                  onChange({ target: { value: "" } });
                  close();
                }}
                className={`type-button w-full text-center mt-2 ${theme.subtext} hover:opacity-80`}
              >
                Clear date
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
