/* -------------------------------------------------------------------------
   Centralized recurring-bill semantic type registry.

   Distinct from serviceRegistry.js (real brand logos, rendered via
   <ServiceLogo />) and iconRegistry.js (the raw icon lookup table, rendered
   via <AppIcon />) — this file is the single place that:

     1. Lists the common non-brand recurring bill types (rent, electricity,
        water, ...) as selectable provider options, each pointing at an
        existing `bills.*` icon key from iconRegistry.js.

     2. Recognizes a bill's semantic type from its name/category, so
        "Other / Custom" bills with a recognizable name (e.g. "House Rent")
        still get the right icon instead of the generic fallback.

   BillForm.jsx and BillsPage.jsx both call resolveBillDisplay() below
   rather than each re-implementing this matching — keeps the recognition
   logic in one place.
------------------------------------------------------------------------- */

import { SERVICES } from "./serviceRegistry";

export const BILL_TYPES = [
  {
    id: "rent",
    name: "House Rent",
    category: "Rent",
    icon: "bills.rent",
    categoryInfers: true,
    keywords: ["rent"],
  },
  {
    id: "electricity",
    name: "Electricity",
    category: "Utilities",
    icon: "bills.electricity",
    categoryInfers: false,
    keywords: ["electricity", "electric", "eb"],
  },
  {
    id: "water",
    name: "Water",
    category: "Utilities",
    icon: "bills.water",
    categoryInfers: false,
    keywords: ["water"],
  },
  {
    id: "gas",
    name: "Gas",
    category: "Utilities",
    icon: "bills.gas",
    categoryInfers: false,
    keywords: ["gas", "lpg"],
  },
  {
    id: "internet",
    name: "Internet / Wi-Fi",
    category: "Utilities",
    icon: "bills.internet",
    categoryInfers: false,
    keywords: ["internet", "wifi", "broadband"],
  },
  {
    id: "phone",
    name: "Mobile / Phone",
    category: "Utilities",
    icon: "bills.phone",
    categoryInfers: false,
    keywords: ["phone", "mobile"],
  },
  {
    id: "insurance",
    name: "Insurance",
    category: "Insurance",
    icon: "bills.insurance",
    categoryInfers: true,
    keywords: ["insurance"],
  },
  {
    id: "loan",
    name: "Loan / EMI",
    category: "EMI",
    icon: "bills.loan",
    categoryInfers: true,
    keywords: ["loan", "emi"],
  },
  {
    id: "subscription",
    name: "Subscription",
    category: "Subscriptions",
    icon: "bills.subscription",
    categoryInfers: true,
    keywords: ["subscription"],
  },
];

const GENERIC_ICON = "bills.bill";

export function getBillType(id) {
  return BILL_TYPES.find((t) => t.id === id) || null;
}

// Word-based matching only (never a bare substring check) so e.g. "rent"
// doesn't fire on "parent", and "gas" doesn't fire on "Vegas Trip".
//
// "Wi-Fi" / "Wi Fi" / "WiFi" are normalized to one token before splitting
// so all three spellings match the same "wifi" keyword.
function nameWords(name) {
  const normalized = (name || "")
    .toLowerCase()
    .replace(/wi[\s-]?fi/g, "wifi");

  return normalized
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

// Recognizes a bill's semantic type from its name, falling back to category
// only for categories that unambiguously imply one type.
//
// Utilities is deliberately excluded because it is shared by multiple
// different bill types.
export function getBillSemanticType(name, category) {
  const words = nameWords(name);

  const byName = BILL_TYPES.find((t) =>
    t.keywords.some((k) => words.includes(k))
  );

  if (byName) return byName;

  const normalizedCategory = (category || "").trim().toLowerCase();

  if (!normalizedCategory) return null;

  return (
    BILL_TYPES.find(
      (t) =>
        t.categoryInfers &&
        t.category.toLowerCase() === normalizedCategory
    ) || null
  );
}

// Single source of truth for what this bill should display.
//
// A. Recognized brand provider -> ServiceLogo
// B. Provider is a semantic bill type -> AppIcon
// C. Custom provider with recognizable name/category -> AppIcon
// D. Anything else -> generic AppIcon
export function resolveBillDisplay(bill) {
  const providerId = bill?.provider || "custom";

  const brand = SERVICES.find(
    (s) => s.id === providerId && s.id !== "custom"
  );

  if (brand) {
    return {
      kind: "brand",
      providerId: brand.id,
    };
  }

  const semanticProvider = getBillType(providerId);

  if (semanticProvider) {
    return {
      kind: "semantic",
      icon: semanticProvider.icon,
      type: semanticProvider,
    };
  }

  const recognized = getBillSemanticType(
    bill?.name,
    bill?.category
  );

  if (recognized) {
    return {
      kind: "semantic",
      icon: recognized.icon,
      type: recognized,
    };
  }

  return {
    kind: "generic",
    icon: GENERIC_ICON,
  };
}