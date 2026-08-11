import { CalendarClock } from "lucide-react";
import { getService } from "../utils/serviceRegistry";

const SIZE_CLASSES = {
  sm: "w-8 h-8 rounded-[10px]",
  md: "w-10 h-10 rounded-[14px]",
  widget: "w-[34px] h-[34px] rounded-xl",
};

export function ServiceLogo({ provider, size = "md", className = "" }) {
  const service = getService(provider);
  const boxCls = `${SIZE_CLASSES[size] || SIZE_CLASSES.md} flex items-center justify-center shrink-0 ${className}`;
  const iconPx = size === "sm" ? 15 : size === "widget" ? 13 : 18;

  if (service.icon) {
    return (
      <div className={boxCls} style={{ backgroundColor: `#${service.icon.hex}1F` }} title={service.name}>
        <svg viewBox="0 0 24 24" width={iconPx} height={iconPx} fill={`#${service.icon.hex}`} aria-hidden="true">
          <path d={service.icon.path} />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${boxCls} bg-white/5`} title={service.name}>
      <CalendarClock size={iconPx} className="opacity-70" />
    </div>
  );
}
