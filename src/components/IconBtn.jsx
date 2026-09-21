import { useApp } from "../context/AppContext";
import { AppIcon } from "./AppIcon";

export function IconBtn({ icon, onClick, danger = false, title, type = "button", disabled = false }) {
  const { theme } = useApp();
  return (
    <button type={type} title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={`forge-button p-1.5 rounded-[10px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${danger ? "hover:bg-danger/10 hover:text-danger" : theme.hover}`}>
      <AppIcon name={icon} size={15} />
    </button>
  );
}