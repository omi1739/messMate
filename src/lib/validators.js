import { z } from "zod";
import { MONTH_KEY_PATTERN, parseDateInput } from "@/lib/date";

export const MEMBER_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"];

export const EXPENSE_CATEGORIES = [
  "BAZAR",
  "CLEANING",
  "KITCHEN",
  "GAS_CYLINDER",
  "MAINTENANCE",
  "FURNITURE",
  "OTHER",
];

export const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "PKR", "AED"];

/** Categories that get split evenly across active members (everything except bazar). */
export const NON_SHARED_EQUALLY = "BAZAR";

export const EXPENSE_CATEGORY_LABELS = {
  BAZAR: "Bazar / Groceries",
  CLEANING: "Cleaning",
  KITCHEN: "Kitchen",
  GAS_CYLINDER: "Gas cylinder",
  MAINTENANCE: "Maintenance",
  FURNITURE: "Furniture",
  OTHER: "Other",
};

export const MEMBER_STATUS_LABELS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

// ---------------------------------------------------------------------------
// Shared field builders
// ---------------------------------------------------------------------------

const requiredText = (min, max, label) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be under ${max} characters`);

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Must be under ${max} characters`)
    .optional()
    .default("")
    .transform((v) => v || null);

const money = (max = 10_000_000) =>
  z.coerce
    .number({ error: "Enter a valid amount" })
    .min(0, "Cannot be negative")
    .max(max, "That amount looks too large");

const positiveMoney = (max = 10_000_000) =>
  z.coerce
    .number({ error: "Enter a valid amount" })
    .positive("Must be greater than 0")
    .max(max, "That amount looks too large");

/** Meal counts are in half-meal steps (0, 0.5, 1, 1.5, ...). */
const mealCount = z.coerce
  .number({ error: "Enter a valid number of meals" })
  .min(0, "Cannot be negative")
  .max(4, "Max 4 meals a day")
  .refine((v) => Number.isInteger(v * 2), "Meals must be in halves (e.g. 0.5, 1, 1.5)");

const dateInput = z
  .string({ error: "Pick a date" })
  .refine((v) => parseDateInput(v) !== null, "Pick a valid date");

const monthKey = z
  .string({ error: "Pick a month" })
  .regex(MONTH_KEY_PATTERN, "Pick a valid month");

const objectId = z
  .string({ error: "Required" })
  .min(1, "Required")
  .max(40, "Invalid identifier");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signupSchema = z.object({
  name: requiredText(2, 60, "Your name"),
  email: z
    .email({ error: "Enter a valid email address" })
    .trim()
    .toLowerCase(),
  password: z
    .string({ error: "Choose a password" })
    .min(8, "Use at least 8 characters")
    // bcrypt silently truncates beyond 72 bytes, so reject rather than mislead.
    .max(72, "Use at most 72 characters")
    .regex(/[a-zA-Z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
  messName: requiredText(2, 60, "Mess name"),
});

export const loginSchema = z.object({
  email: z
    .email({ error: "Enter a valid email address" })
    .trim()
    .toLowerCase(),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72, "Use at most 72 characters")
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    error: "New password must be different from the current one",
    path: ["newPassword"],
  });

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const messSettingsSchema = z.object({
  name: requiredText(2, 60, "Mess name"),
  currency: z.enum(CURRENCIES, { error: "Pick a currency" }),
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberSchema = z.object({
  name: requiredText(2, 60, "Name"),
  phone: z
    .string({ error: "Phone is required" })
    .trim()
    .min(6, "Enter a valid phone number")
    .max(20, "Enter a valid phone number")
    .regex(/^[0-9+\-()\s]+$/, "Digits, spaces, + and ( ) only"),
  joiningDate: dateInput,
  status: z.enum(MEMBER_STATUSES, { error: "Pick a status" }).default("ACTIVE"),
  rent: money(1_000_000).default(0),
  notes: optionalText(280),
  photoUrl: z
    .union([z.url({ error: "Enter a valid link" }), z.literal("")])
    .optional()
    .default("")
    .transform((v) => v || null),
});

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export const mealEntrySchema = z.object({
  date: dateInput,
  memberId: objectId,
  breakfast: mealCount.default(0),
  lunch: mealCount.default(0),
  dinner: mealCount.default(0),
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const expenseSchema = z.object({
  date: dateInput,
  category: z.enum(EXPENSE_CATEGORIES, { error: "Pick a category" }),
  description: requiredText(2, 120, "Description"),
  amount: positiveMoney(),
  notes: optionalText(280),
});

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------

export const billSchema = z.object({
  month: monthKey,
  water: money().default(0),
  electricity: money().default(0),
  gas: money().default(0),
  wifi: money().default(0),
  other: money().default(0),
});

export const customBillSchema = z.object({
  month: monthKey,
  title: requiredText(2, 80, "Title"),
  amount: positiveMoney(),
  notes: optionalText(280),
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const paymentSchema = z.object({
  month: monthKey,
  memberId: objectId,
  rentPaid: money().default(0),
  mealPaid: money().default(0),
  utilityPaid: money().default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `{ fieldName: "message" }` from a ZodError — ready to hand to the UI. */
export function fieldErrors(error) {
  const flat = error.flatten();
  const out = {};
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.length) out[key] = messages[0];
  }
  return out;
}
