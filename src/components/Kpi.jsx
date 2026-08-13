import { AppIcon } from "./AppIcon";
import { useApp } from "../context/AppContext";
import { Card } from "./Card";

/* ------------------------------- KPI card ------------------------------- */

export function Kpi({ label, value, sub, trend, icon: Icon }) {
  const { theme } = useApp();
  return (
    <Card className="p-8 group">
      <div className="flex items-start justify-between">
        <div>
          <p className={`type-card-label opacity-80 ${theme.subtext}`}>{label}</p>
          <p className="type-display-number mt-3">{value}</p>
          {sub && (
            <p className={`type-secondary mt-3 flex items-center gap-1 ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : theme.faint}`}>
              {trend === "up" && <AppIcon name="ui.trendUp" size={12} />}
              {trend === "down" && <AppIcon name="ui.trendDown" size={12} />}
              {sub}
            </p>
          )}
        </div>
        {Icon && (
          <div className="forge-card-icon w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center shrink-0">
            <Icon size={16} className="forge-card-icon__glyph" />
          </div>
        )}
      </div>
    </Card>
  );
}
