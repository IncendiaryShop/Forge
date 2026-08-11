import { getBank } from "../utils/bankRegistry";
import { AppIcon } from "./AppIcon";

/* -------------------------------------------------------------------------
   <AccountLogo /> — single source of truth for an account's visual
   identity, used anywhere an account is rendered as more than plain text.

   Priority:
   - Credit Card  -> CreditCard icon as the main glyph, with the bank's
                     official logo (if any) as a small corner badge.
   - Cash         -> generic wallet/cash icon, no bank badge.
   - has provider -> the bank's official logo as the main glyph.
   - otherwise    -> generic account icon fallback.
------------------------------------------------------------------------- */

const SIZE_CLASSES = {
  sm: "w-8 h-8 rounded-[10px]",
  md: "w-10 h-10 rounded-[14px]",
};

const ICON_PX = { sm: 15, md: 18 };
const BADGE_PX = { sm: 9, md: 10 };
const BADGE_BOX = { sm: "w-4 h-4", md: "w-[18px] h-[18px]" };

function BankMark({ icon, px, alt }) {
  if (icon.image) {
    return <img src={icon.image} alt={alt} width={px} height={px} className="object-contain" />;
  }
  return (
    <svg viewBox="0 0 24 24" width={px} height={px} fill={`#${icon.hex}`} aria-hidden="true">
      <path d={icon.path} />
    </svg>
  );
}

export function AccountLogo({ account, size = "md", className = "" }) {
  const boxCls = `${SIZE_CLASSES[size] || SIZE_CLASSES.md} flex items-center justify-center shrink-0 relative ${className}`;
  const iconPx = ICON_PX[size] || ICON_PX.md;
  const bank = getBank(account?.provider);

  if (account?.type === "Credit Card") {
    return (
      <div className={`${boxCls} bg-white/5`} title={bank?.name ? `${account.name} · ${bank.name}` : account?.name}>
        <AppIcon name="accountTypes.creditCard" size={iconPx} />
        {bank?.icon && (
          <div
            className={`absolute -bottom-1 -right-1 ${BADGE_BOX[size] || BADGE_BOX.md} rounded-full bg-bg border ${size === "sm" ? "border-[1.5px]" : "border-2"} border-elevated flex items-center justify-center overflow-hidden ${bank.icon.hex ? "" : "bg-white"}`}
            style={bank.icon.hex ? { backgroundColor: `#${bank.icon.hex}1F` } : undefined}
          >
            <BankMark icon={bank.icon} px={BADGE_PX[size] || BADGE_PX.md} alt={bank.name} />
          </div>
        )}
      </div>
    );
  }

  if (account?.type === "Cash") {
    return (
      <div className={`${boxCls} bg-white/5`} title={account?.name}>
        <AppIcon name="accountTypes.cash" size={iconPx} />
      </div>
    );
  }

  if (account?.provider) {
    if (bank?.icon) {
      return (
        <div
          className={`${boxCls} ${bank.icon.hex ? "" : "bg-white"}`}
          style={bank.icon.hex ? { backgroundColor: `#${bank.icon.hex}1F` } : undefined}
          title={bank.name}
        >
          <BankMark icon={bank.icon} px={iconPx} alt={bank.name} />
        </div>
      );
    }
    return (
      <div className={`${boxCls} bg-white/5`} title={bank?.name || account?.name}>
        <AppIcon name="accountTypes.bank" size={iconPx} />
      </div>
    );
  }

  return (
    <div className={`${boxCls} bg-white/5`} title={account?.name}>
      <AppIcon name={`accountTypes.${(account?.type === "Fixed Deposit" && "fixed-deposit") || (account?.type === "Investment" && "investment") || (account?.type === "Wallet" && "wallet") || "other"}`} size={iconPx} />
    </div>
  );
}