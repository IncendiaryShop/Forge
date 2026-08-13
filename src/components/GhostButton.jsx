import { useApp } from "../context/AppContext";

export function GhostButton({ children, onClick, className = "", type = "button" }) {
  const { theme } = useApp();
  return (
    <button type={type} onClick={onClick}
      className={`forge-button type-button inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[10px] border ${theme.border} ${theme.hover} ${className}`}>
      {children}
    </button>
  );
}
