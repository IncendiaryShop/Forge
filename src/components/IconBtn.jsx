import { useApp } from "../context/AppContext";
import { AppIcon } from "./AppIcon";

export function IconBtn({ icon, onClick, danger = false, title, type = "button" }) {
  const { theme } = useApp();
  return (
    <button type={type} title={title} aria-label={title} onClick={onClick}
      className={`forge-button p-1.5 rounded-[10px] ${danger ? "hover:bg-red-500/10 hover:text-red-500" : theme.hover}`}>
      <AppIcon name={icon} size={15} />
    </button>
  );
}
