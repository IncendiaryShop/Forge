import { useRef, useState, useEffect } from "react";
import { AppIcon } from "./AppIcon";
import { Card } from "./Card";
import { useApp } from "../context/AppContext";

function Slide({ label, value, sub, trend, iconName }) {
  const { theme } = useApp();
  return (
    <div className="snap-center shrink-0 w-full px-0.5">
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className={`type-card-label opacity-80 ${theme.subtext}`}>{label}</p>
            <p className="type-display-number mt-2 truncate">{value}</p>
            {sub && (
              <p className={`type-secondary mt-2 flex items-center gap-1 ${trend === "up" ? "text-success" : trend === "down" ? "text-danger" : theme.faint}`}>
                {trend === "up" && <AppIcon name="ui.trendUp" size={12} />}
                {trend === "down" && <AppIcon name="ui.trendDown" size={12} />}
                {sub}
              </p>
            )}
          </div>
          <div className="forge-card-icon w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center shrink-0">
            <AppIcon name={iconName} size={16} className="forge-card-icon__glyph" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function KpiCarousel({ totalBalance, income, expense, fmt }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(1);

  const slides = [
    { key: "earning", label: "Earning Overview", value: fmt(income), sub: "This month", trend: "up", iconName: "dashboard.earnings" },
    { key: "balance", label: "Total Balance", value: fmt(totalBalance), sub: "Updated from linked accounts", trend: null, iconName: "dashboard.balance" },
    { key: "spending", label: "Spending Overview", value: fmt(expense), sub: "This month", trend: "down", iconName: "dashboard.spending" },
  ];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * 1, behavior: "instant" });
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(idx);
  };

  const goTo = (idx) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * idx, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s) => (
          <Slide key={s.key} label={s.label} value={s.value} sub={s.sub} trend={s.trend} iconName={s.iconName} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-3">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={s.label}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-200 ${active === i ? "w-5 bg-accent" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
}
