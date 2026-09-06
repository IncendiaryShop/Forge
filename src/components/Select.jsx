import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import { AppIcon } from "./AppIcon";

function optionFromElement(el) {
  const value = el.props.value !== undefined ? el.props.value : el.props.children;
  return { kind: "option", value, label: el.props.children, disabled: !!el.props.disabled };
}

function flattenOptions(children) {
  const items = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === "optgroup") {
      items.push({ kind: "group", label: child.props.label });
      Children.forEach(child.props.children, (opt) => {
        if (isValidElement(opt) && opt.type === "option") items.push(optionFromElement(opt));
      });
      return;
    }

    if (child.type === "option") items.push(optionFromElement(child));
  });
  return items;
}

const MENU_GAP = 6;
const MENU_MIN_HEIGHT = 160;
const MENU_VIEWPORT_MARGIN = 12;

export function Select({
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  className = "",
  placeholder = "Select",
}) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listboxId = useId();

  const items = useMemo(() => flattenOptions(children), [children]);
  const selectableItems = useMemo(() => items.filter((it) => it.kind === "option"), [items]);
  const selected = selectableItems.find((it) => String(it.value) === String(value));

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < MENU_MIN_HEIGHT + MENU_GAP && spaceAbove > spaceBelow;

    const maxWidth = Math.max(rect.width, Math.min(360, viewportW - MENU_VIEWPORT_MARGIN * 2));

    const overflowsRight = rect.left + maxWidth > viewportW - MENU_VIEWPORT_MARGIN;
    const horizontal = overflowsRight
      ? { right: Math.max(MENU_VIEWPORT_MARGIN, viewportW - rect.right) }
      : { left: Math.max(MENU_VIEWPORT_MARGIN, rect.left) };

    setMenuStyle({
      position: "fixed",
      minWidth: rect.width,
      maxWidth,
      ...horizontal,
      ...(openUp
        ? { bottom: viewportH - rect.top + MENU_GAP, maxHeight: Math.max(MENU_MIN_HEIGHT, spaceAbove - MENU_GAP - MENU_VIEWPORT_MARGIN) }
        : { top: rect.bottom + MENU_GAP, maxHeight: Math.max(MENU_MIN_HEIGHT, spaceBelow - MENU_GAP - MENU_VIEWPORT_MARGIN) }),
    });
  };

  const openMenu = () => {
    if (disabled || selectableItems.length === 0) return;
    reposition();
    setOpen(true);
    const idx = selectableItems.findIndex((it) => String(it.value) === String(value));
    setActiveIndex(idx >= 0 ? idx : 0);
  };

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => reposition();
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      close();
    };

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const commit = (item) => {
    if (!item || item.disabled) return;
    onChange({ target: { value: String(item.value) } });
    close();
  };

  const moveActive = (delta) => {
    if (selectableItems.length === 0) return;
    setActiveIndex((current) => {
      let next = current;
      for (let i = 0; i < selectableItems.length; i++) {
        next = (next + delta + selectableItems.length) % selectableItems.length;
        if (!selectableItems[next]?.disabled) return next;
      }
      return current;
    });
  };

  const onTriggerKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(selectableItems[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  };

  const sizeClasses = className || "w-full px-3.5 py-2.5 rounded-[14px] text-base";
  const triggerClasses = `forge-control border outline-none ${sizeClasses} ${theme.input}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-required={required || undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`${triggerClasses} flex items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={`truncate ${selected ? "" : theme.subtext}`}>
          {selected ? selected.label : placeholder}
        </span>
        <AppIcon
          name="ui.chevronDown"
          size={11}
          className={`shrink-0 transition-transform duration-200 ${theme.subtext} ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          id={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          style={menuStyle}
          data-no-rubber-band
          className={`forge-modal forge-scroll-contain z-[70] overflow-auto rounded-[14px] border ${theme.card} shadow-xl shadow-black/30 p-1.5 outline-none`}
        >
          {items.map((it, i) => {
            if (it.kind === "group") {
              return (
                <div key={`g-${i}`} className={`px-2.5 pt-2.5 pb-1 type-small-label ${theme.faint}`}>
                  {it.label}
                </div>
              );
            }

            const optIndex = selectableItems.indexOf(it);
            const isSelected = it === selected;
            const isActive = optIndex === activeIndex;

            return (
              <div
                key={`o-${i}`}
                id={`${listboxId}-opt-${optIndex}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={it.disabled || undefined}
                onMouseEnter={() => !it.disabled && setActiveIndex(optIndex)}
                onClick={() => commit(it)}
                className={`
                  flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[10px] text-[14px]
                  transition-colors duration-150
                  ${it.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  ${isActive && !it.disabled ? "bg-elevated" : ""}
                  ${isSelected ? "text-accent font-medium" : "text-text"}
                `}
              >

                <span className="break-words">{it.label}</span>
                {isSelected && <AppIcon name="ui.check" size={11} className="shrink-0 text-accent" />}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
