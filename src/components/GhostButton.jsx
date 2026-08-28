import { useApp } from "../context/AppContext";

export function GhostButton({ children, onClick, className = "", type = "button", title }) {
  const { theme } = useApp();
  return (
    <button type={type} onClick={onClick} title={title} aria-label={title}
      className={`forge-button type-button inline-flex items-center gap-1.5 min-w-0 px-3.5 py-2.5 rounded-[10px] border whitespace-nowrap overflow-hidden text-ellipsis ${theme.border} ${theme.hover} ${className}`}>
      {children}
    </button>
  );
}