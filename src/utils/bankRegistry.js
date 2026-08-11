import { siHdfcbank, siIcicibank, siAxisbank, siHsbc } from "simple-icons";
import sbiLogo from "../assets/banks/sbi_logo.svg";
import bobLogo from "../assets/banks/bob_logo.svg";

/* -------------------------------------------------------------------------
   Centralized bank/provider registry for ACCOUNT visual identity.
   Mirrors serviceRegistry.js: stable provider id -> display name ->
   official brand icon (from the bundled, offline `simple-icons` package).

   Two entries (sbi, bob) use locally-stored official logo assets under
   src/assets/banks/ instead of simple-icons, since simple-icons doesn't
   distribute them. Their `icon` shape is `{ image: <asset url> }` rather
   than simple-icons' `{ hex, path }` — AccountLogo renders whichever
   shape is present.

   Several other Indian banks (Kotak, Yes Bank, IndusInd, etc.) still have
   no available offline/bundled source for their official marks. Rather
   than approximate/fabricate those marks, `icon` is left null and the UI
   falls back to the generic bank/account icon — same fallback used for
   "other"/no-provider accounts.

   This is intentionally a separate registry from serviceRegistry.js:
   that one covers recurring-payment SERVICES (Netflix, Spotify, ...),
   this one covers ACCOUNT-holding banks. Keeping them distinct avoids
   mixing two unrelated domains into one lookup.
------------------------------------------------------------------------- */

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
  { id: "other", name: "Other / Custom", icon: null },
];

const OTHER_BANK = BANKS[BANKS.length - 1];

export function getBank(providerId) {
  if (!providerId) return null;
  return BANKS.find(b => b.id === providerId) || OTHER_BANK;
}