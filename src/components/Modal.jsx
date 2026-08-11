import { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
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

  return (
    <div className={`forge-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${theme.modalOverlay}`} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`forge-modal w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[85vh] overflow-y-auto rounded-[20px] border ${theme.card} p-7 shadow-xl shadow-black/30 outline-none`}>
        <div className="flex items-center justify-between mb-6">
          <h3 id={titleId} className="type-section-title">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={`forge-button p-1.5 rounded-[10px] ${theme.hover}`}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
