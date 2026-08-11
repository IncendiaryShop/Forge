import { createElement } from "react";
import { resolveIcon } from "../utils/iconRegistry";
import { ICON_SIZES } from "../utils/iconSizes";
/* -------------------------------------------------------------------------
   <AppIcon /> — the single interface for Forge's semantic (Lucide-based)
   iconography. Pages should look icons up by name here instead of
   importing individual Lucide icons ad hoc, so the registry stays the
   one source of truth.

   For real brand/service logos, use <ServiceLogo /> instead — never mix
   the two systems.
------------------------------------------------------------------------- */

export function AppIcon({ name, size = "md", strokeWidth = 1.8, className = "", container = false, containerClassName = "" }) {
  const px = typeof size === "number" ? size : (ICON_SIZES[size] || ICON_SIZES.md);
const icon = createElement(resolveIcon(name), {
  size: px,
  strokeWidth,
  className,
  "aria-hidden": true,
});

  if (!container) return icon;

  return (
    <div className={`forge-card-icon w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center shrink-0 ${containerClassName}`}>
      {icon}
    </div>
  );
}