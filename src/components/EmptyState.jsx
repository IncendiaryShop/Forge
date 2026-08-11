import { useApp } from "../context/AppContext";

export function EmptyState({ icon: Icon, title, subtitle, description, action }) {
  const { theme } = useApp();
  const sub = subtitle || description;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 bg-elevated">
        <Icon size={20} className={theme.subtext} />
      </div>
      <p className="type-body font-medium">{title}</p>
      {sub && <p className={`type-secondary opacity-75 mt-2 ${theme.subtext}`}>{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
