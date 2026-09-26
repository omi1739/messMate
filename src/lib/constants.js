/**
 * Plain data shared by both server and client code.
 *
 * These live apart from `src/lib/validators.js` on purpose: the validators
 * import Zod, and client components that need a label or an option list must
 * not drag the validation library into the browser bundle.
 */

export const MEMBER_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];

export const MEMBER_STATUS_LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

/** One-line explanation shown next to each status option. */
export const MEMBER_STATUS_HINTS = {
  ACTIVE: "Pays seat rent and shares utilities.",
  INACTIVE: "Still eats, but is not charged rent or utilities.",
  ARCHIVED: "Left the mess. Keeps their history, pays nothing.",
};

export const EXPENSE_CATEGORIES = [
  "BAZAR",
  "CLEANING",
  "KITCHEN",
  "GAS_CYLINDER",
  "MAINTENANCE",
  "FURNITURE",
  "OTHER",
];

export const EXPENSE_CATEGORY_LABELS = {
  BAZAR: "Bazar / Groceries",
  CLEANING: "Cleaning",
  KITCHEN: "Kitchen",
  GAS_CYLINDER: "Gas cylinder",
  MAINTENANCE: "Maintenance",
  FURNITURE: "Furniture",
  OTHER: "Other",
};

/** Bazar is the only category that is *not* split evenly — it drives the rate. */
export const NON_SHARED_EQUALLY = "BAZAR";

export const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "PKR", "AED"];

export const UTILITY_FIELDS = [
  { key: "water", label: "Water" },
  { key: "electricity", label: "Electricity" },
  { key: "gas", label: "Gas" },
  { key: "wifi", label: "Internet" },
  { key: "other", label: "Other utilities" },
];

/** Badge tone per member status, so the colour rule lives in one place. */
export const MEMBER_STATUS_TONE = {
  ACTIVE: "success",
  INACTIVE: "warning",
  ARCHIVED: "neutral",
};
