import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faArrowDown,
  faArrowUp,
  faRightLeft,

  faBagShopping,
  faUtensils,
  faCartShopping,
  faCar,
  faHouse,
  faBolt,
  faDroplet,
  faFire,
  faWifi,
  faMobileScreenButton,
  faHeartPulse,
  faGraduationCap,
  faGamepad,
  faPlane,
  faShieldHalved,

  faRotate,
  faReceipt,
  faPercent,

  faLandmark,
  faWallet,
  faCreditCard,
  faPiggyBank,
  faChartLine,
  faWallet as faWalletCards,

  faFileLines,
  faClock,
  faCircleCheck,
  faMoneyBill,

  faBullseye,
  faCirclePlus,
  faCalendarDays,

  faArrowTrendUp,
  faArrowTrendDown,
  faChartPie,
  faFileInvoice,
  faTriangleExclamation,
  faIndianRupeeSign,
  faPlus,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faDownload,
  faXmark,
  faCircleInfo,
  faChevronLeft,
  faChevronRight,
  faChevronDown,
  faCheck,
  faRightFromBracket,
  faEllipsis,
  faEye,
} from "@fortawesome/free-solid-svg-icons";

function fa(icon) {
  return function ForgeFontAwesomeIcon(props) {
    return (
      <FontAwesomeIcon
        icon={icon}
        {...props}
      />
    );
  };
}

const ArrowDownLeft = fa(faArrowDown);
const ArrowUpRight = fa(faArrowUp);
const ArrowLeftRight = fa(faRightLeft);

const ShoppingBag = fa(faBagShopping);
const Utensils = fa(faUtensils);
const ShoppingCart = fa(faCartShopping);
const Car = fa(faCar);
const House = fa(faHouse);
const Zap = fa(faBolt);
const Droplets = fa(faDroplet);
const Flame = fa(faFire);
const Wifi = fa(faWifi);
const Smartphone = fa(faMobileScreenButton);
const HeartPulse = fa(faHeartPulse);
const GraduationCap = fa(faGraduationCap);
const Gamepad2 = fa(faGamepad);
const Plane = fa(faPlane);
const ShieldCheck = fa(faShieldHalved);

const RefreshCw = fa(faRotate);
const Receipt = fa(faReceipt);
const BadgePercent = fa(faPercent);

const Landmark = fa(faLandmark);
const Wallet = fa(faWallet);
const CreditCard = fa(faCreditCard);
const PiggyBank = fa(faPiggyBank);
const ChartNoAxesCombined = fa(faChartLine);
const WalletCards = fa(faWalletCards);

const FileText = fa(faFileLines);
const Clock3 = fa(faClock);
const CircleCheck = fa(faCircleCheck);
const Banknote = fa(faMoneyBill);

const Target = fa(faBullseye);
const PlusCircle = fa(faCirclePlus);
const Eye = fa(faEye);
const CalendarClock = fa(faCalendarDays);

const TrendingUp = fa(faArrowTrendUp);
const TrendingDown = fa(faArrowTrendDown);
const ChartPie = fa(faChartPie);
const ReceiptText = fa(faFileInvoice);
const Home = fa(faHouse);
const IndianRupee = fa(faIndianRupeeSign);
const TriangleAlert = fa(faTriangleExclamation);

const Plus = fa(faPlus);
const Pencil = fa(faPen);
const Trash2 = fa(faTrash);
const Search = fa(faMagnifyingGlass);
const Download = fa(faDownload);
const XIcon = fa(faXmark);
const InfoCircle = fa(faCircleInfo);
const ChevronLeft = fa(faChevronLeft);
const ChevronRight = fa(faChevronRight);
const ChevronDown = fa(faChevronDown);
const Check = fa(faCheck);
const LogOut = fa(faRightFromBracket);
const MoreHoriz = fa(faEllipsis);

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
    loan: Landmark,
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
  home: Home,
  transactions: IndianRupee,
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

  ui: {
    add: Plus,
    edit: Pencil,
    delete: Trash2,
    search: Search,
    download: Download,
    close: XIcon,
    info: InfoCircle,
    rupee: IndianRupee,

    calendar: CalendarClock,

    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronDown: ChevronDown,
    check: Check,
    signOut: LogOut,
    warning: TriangleAlert,
    trendUp: TrendingUp,
    trendDown: TrendingDown,
    checkCircle: CircleCheck,
    emi: BadgePercent,
    more: MoreHoriz,
    view: Eye,

    _fallback: InfoCircle,
  },
};

export function resolveIcon(name) {
  if (!name || typeof name !== "string") {
    return Receipt;
  }

  const [groupName, key] = name.split(".");
  const group = ICONS[groupName];

  if (!group) {
    return Receipt;
  }

  return group[key] || group._fallback || Receipt;
}
