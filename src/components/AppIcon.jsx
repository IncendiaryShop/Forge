import { createElement, useMemo } from "react";
import { resolveIcon } from "../utils/iconRegistry";
import { ICON_SIZES } from "../utils/iconSizes";

export function AppIcon({ name, size = "md", className = "", container = false, containerClassName = "" }) {
  const px = typeof size === "number" ? size : (ICON_SIZES[size] || ICON_SIZES.md);
  const Icon = useMemo(() => resolveIcon(name), [name]);
  const icon = createElement(Icon, {
    style: { width: px, height: px },
    className,
    "aria-hidden": "true",
  });

  if (!container) return icon;

  return (
    <div className={`forge-card-icon w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center shrink-0 ${containerClassName}`}>
      {icon}
    </div>
  );
}
