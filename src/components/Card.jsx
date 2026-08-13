import { useApp } from "../context/AppContext";

export function Card({ children, className = "" }) {
  const { theme } = useApp();

  return (
    <div className="forge-card">
      <div className={`forge-card__surface ${theme.card} border rounded-[16px] ${className}`}>
        
        {children}
      </div>
    </div>
  );
}
