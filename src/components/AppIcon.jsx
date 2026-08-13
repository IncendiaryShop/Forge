import { resolveIcon } from "../utils/iconRegistry";
import { ICON_SIZES } from "../utils/iconSizes";
/* -------------------------------------------------------------------------
   <AppIcon /> — the single interface for Forge's semantic (Font
   Awesome-based) iconography. Pages should look icons up by name here
   instead of importing individual Font Awesome icons ad hoc, so the
   registry stays the one source of truth.

   For real brand/service logos, use <ServiceLogo /> instead — never mix
   the two systems.
------------------------------------------------------------------------- */

export function AppIcon({ name, size = "md", className = "", container = false, containerClassName = "" }) {
  const px = typeof size === "number" ? size : (ICON_SIZES[size] || ICON_SIZES.md);
  const Icon = resolveIcon(name);
  const icon = (
    <Icon
      style={{ width: px, height: px }}
      className={className}
      aria-hidden="true"
    />
  );

  if (!container) return icon;

  return (
    <div className={`forge-card-icon w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center shrink-0 ${containerClassName}`}>
      {icon}
    </div>
  );
}
