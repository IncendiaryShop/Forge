import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  ShoppingBag, Utensils, ShoppingCart, Car, House, Zap, Droplets, Flame,
  Wifi, Smartphone, HeartPulse, GraduationCap, Gamepad2, Plane, ShieldCheck,
  RefreshCw, Receipt, BadgePercent,
  Landmark, Wallet, CreditCard, PiggyBank, ChartNoAxesCombined, WalletCards,
  FileText, Clock3, CircleCheck, Banknote,
  Target, PlusCircle, CalendarClock,
  TrendingUp, TrendingDown, ChartPie, ReceiptText, LayoutDashboard,
  TriangleAlert,
} from "lucide-react";

/* -------------------------------------------------------------------------
   Icon System V2 — centralized semantic icon registry.

   This registry maps a stable, semantic key (grouped by domain) to a
   Lucide icon component. Every group has an explicit `_fallback` entry
   used when a requested key isn't found, so a lookup can never resolve to
   undefined/blank/broken.

   Real-world brand/service logos (YouTube, Netflix, Spotify, etc.) are
   intentionally NOT part of this file — those live in serviceRegistry.js
   and render via <ServiceLogo />. This registry only covers Forge's own
   semantic, generic iconography, rendered via <AppIcon />.
------------------------------------------------------------------------- */

export const ICONS = {
  transactionTypes: {
    income: ArrowDownLeft,
    expense: ArrowUpRight,
    transfer: ArrowLeftRight,
    _fallback: Receipt,
  },

  categories: {
    shopping: ShoppingBag,
    food: Utensils,
    groceries: ShoppingCart,
    transport: Car,
    transportation: Car,
    fuel: Flame,
    rent: House,
    utilities: Zap,
    electricity: Zap,
    water: Droplets,
    gas: Flame,
    internet: Wifi,
    phone: Smartphone,
    healthcare: HeartPulse,
    medical: HeartPulse,
    education: GraduationCap,
    entertainment: Gamepad2,
    travel: Plane,
    insurance: ShieldCheck,
    subscriptions: RefreshCw,
    family: HeartPulse,
    emi: BadgePercent,
    miscellaneous: Receipt,
    other: Receipt,
    _fallback: Receipt,
  },

  accountTypes: {
    bank: Landmark,
    cash: Wallet,
    "credit-card": CreditCard,
    creditCard: CreditCard,
    savings: PiggyBank,
    "fixed-deposit": PiggyBank,
    investment: ChartNoAxesCombined,
    wallet: WalletCards,
    other: WalletCards,
    _fallback: WalletCards,
  },

  invoiceStates: {
    invoice: FileText,
    unpaid: Clock3,
    overdue: TriangleAlert,
    paid: CircleCheck,
    payment: Banknote,
    _fallback: FileText,
  },

  goals: {
    goal: Target,
    savings: PiggyBank,
    contribution: PlusCircle,
    deadline: CalendarClock,
    completed: CircleCheck,
    _fallback: Target,
  },

  dashboard: {
    home: LayoutDashboard,
    balance: Wallet,
    earnings: TrendingUp,
    spending: TrendingDown,
    cashflow: ArrowLeftRight,
    budget: Target,
    upcoming: CalendarClock,
    breakdown: ChartPie,
    recent: ReceiptText,
    invoices: FileText,
    _fallback: Receipt,
  },

  bills: {
  bill: Receipt,
  subscription: RefreshCw,

  electricity: Zap,
  water: Droplets,
  gas: Flame,
  internet: Wifi,
  phone: Smartphone,
  rent: House,
  insurance: ShieldCheck,
  loan: Landmark,

  due: CalendarClock,
  overdue: TriangleAlert,
  paid: CircleCheck,

  _fallback: Receipt,
},
};

/**
 * Resolve a semantic icon by "group.key" (e.g. "categories.food").
 * Always returns a valid component — falls back to the group's
 * `_fallback`, and finally to Receipt if the group itself is unknown.
 */
export function resolveIcon(name) {
  if (!name || typeof name !== "string") return Receipt;
  const [groupName, key] = name.split(".");
  const group = ICONS[groupName];
  if (!group) return Receipt;
  return group[key] || group._fallback || Receipt;
}