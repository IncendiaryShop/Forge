import { useApp } from "../context/AppContext";

export function IconBtn({ icon: Icon, onClick, danger = false, title, type = "button" }) {
  const { theme } = useApp();
  return (
    <button type={type} title={title} aria-label={title} onClick={onClick}
      className={`forge-button p-1.5 rounded-[10px] ${danger ? "hover:bg-red-500/10 hover:text-red-500" : theme.hover}`}>
      <Icon size={15} />
    </button>
  );
}
