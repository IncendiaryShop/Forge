import { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "./AppIcon";
import { useApp } from "../context/AppContext";

export function Modal({ title, onClose, children, wide }) {
  const { theme } = useApp();
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  // Rendered through a portal into document.body — several pages nest
  // their content inside an ancestor with `will-change: transform`
  // (ScrollBounceBoundary's rubber-band wrapper), which creates a new
  // containing block for `position: fixed` descendants and would
  // otherwise size/center this overlay against that ancestor's box
  // instead of the real viewport. Portaling escapes that entirely, the
  // same reasoning <DatePicker /> already uses.
  return createPortal(
    <div
      className={`forge-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${theme.modalOverlay}`}
      onClick={onClose}
      data-no-rubber-band
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`forge-modal w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rounded-[20px] border ${theme.card} p-5 sm:p-7 shadow-xl shadow-black/30 outline-none`}>
        <div className="flex items-center justify-between mb-6">
          <h3 id={titleId} className="type-section-title">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={`forge-button p-1.5 rounded-[10px] ${theme.hover}`}><AppIcon name="ui.close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}