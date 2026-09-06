import { siHdfcbank, siIcicibank, siAxisbank, siHsbc } from "simple-icons";
import sbiLogo from "../assets/banks/sbi_logo.svg";
import bobLogo from "../assets/banks/bob_logo.svg";
import idfcLogo from "../assets/banks/idfc_logo.svg";

export const BANKS = [
  { id: "hdfc", name: "HDFC Bank", icon: siHdfcbank },
  { id: "icici", name: "ICICI Bank", icon: siIcicibank },
  { id: "axis", name: "Axis Bank", icon: siAxisbank },
  { id: "hsbc", name: "HSBC", icon: siHsbc },
  { id: "sbi", name: "State Bank of India", icon: { image: sbiLogo } },
  { id: "bob", name: "Bank of Baroda", icon: { image: bobLogo } },
  { id: "kotak", name: "Kotak Mahindra Bank", icon: null },
  { id: "yesbank", name: "Yes Bank", icon: null },
  { id: "indusind", name: "IndusInd Bank", icon: null },
  { id: "idfc", name: "IDFC FIRST Bank", icon: { image: idfcLogo } },
  { id: "other", name: "Other / Custom", icon: null },
];

const OTHER_BANK = BANKS[BANKS.length - 1];

export function getBank(providerId) {
  if (!providerId) return null;
  return BANKS.find(b => b.id === providerId) || OTHER_BANK;
}
