import assert from "node:assert/strict";
import {
  signupSchema,
  loginSchema,
  changePasswordSchema,
  mealEntrySchema,
  paymentSchema,
  expenseSchema,
  memberSchema,
  billSchema,
  customBillSchema,
  messSettingsSchema,
} from "../src/lib/validators.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.log(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}

const goodPassword = "kitchen42";
const goodSignup = {
  name: "Asha",
  email: "asha@example.com",
  password: goodPassword,
  messName: "Green Villa",
};

console.log("validators");

/*
 * A string format check in Zod runs against the raw input and `.trim()` is a
 * transform, so `z.email().trim()` rejects a padded address instead of cleaning
 * it. Every auth form posts with `noValidate`, so nothing upstream strips the
 * whitespace either. These two tests are the regression guard for that.
 */
test("signup trims and lowercases a padded email", () => {
  const result = signupSchema.safeParse({ ...goodSignup, email: "  Asha@Example.COM  " });
  assert.ok(result.success, "a padded email must be accepted");
  assert.equal(result.data.email, "asha@example.com");
});

test("login trims and lowercases a padded email", () => {
  const result = loginSchema.safeParse({ email: "\tAsha@Example.COM\n", password: goodPassword });
  assert.ok(result.success, "a padded email must be accepted");
  assert.equal(result.data.email, "asha@example.com");
});

test("a genuinely malformed email is still rejected", () => {
  assert.equal(signupSchema.safeParse({ ...goodSignup, email: "not-an-email" }).success, false);
  assert.equal(signupSchema.safeParse({ ...goodSignup, email: "a@b" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "  ", password: goodPassword }).success, false);
});

test("signup rejects a weak password and a short name", () => {
  assert.equal(signupSchema.safeParse({ ...goodSignup, password: "short1" }).success, false);
  assert.equal(signupSchema.safeParse({ ...goodSignup, password: "nodigitshere" }).success, false);
  assert.equal(signupSchema.safeParse({ ...goodSignup, password: "12345678" }).success, false);
  assert.equal(signupSchema.safeParse({ ...goodSignup, name: "A" }).success, false);
  assert.equal(signupSchema.safeParse({ ...goodSignup, messName: "" }).success, false);
});

test("passwords over 72 bytes are refused rather than silently truncated", () => {
  assert.equal(
    signupSchema.safeParse({ ...goodSignup, password: `a1${"x".repeat(80)}` }).success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({ currentPassword: goodPassword, newPassword: goodPassword })
      .success,
    false,
    "the new password must differ from the current one",
  );
});

test("meal counts must be non-negative halves", () => {
  const base = { date: "2026-09-01", memberId: "m1" };
  assert.equal(mealEntrySchema.safeParse({ ...base, lunch: 1.5 }).success, true);
  assert.equal(mealEntrySchema.safeParse({ ...base, lunch: 0.25 }).success, false);
  assert.equal(mealEntrySchema.safeParse({ ...base, lunch: -1 }).success, false);
  assert.equal(mealEntrySchema.safeParse({ ...base, lunch: 9 }).success, false);
});

test("an impossible calendar date is rejected", () => {
  assert.equal(mealEntrySchema.safeParse({ date: "2026-02-31", memberId: "m1" }).success, false);
  assert.equal(mealEntrySchema.safeParse({ date: "2026-13-01", memberId: "m1" }).success, false);
  assert.equal(mealEntrySchema.safeParse({ date: "not-a-date", memberId: "m1" }).success, false);
  assert.equal(mealEntrySchema.safeParse({ date: "2026-09-01", memberId: "m1" }).success, true);
});

test("a month key must be a real YYYY-MM", () => {
  const money = { rentPaid: 0, mealPaid: 0, utilityPaid: 0 };
  assert.equal(paymentSchema.safeParse({ ...money, month: "2026-09", memberId: "m1" }).success, true);
  for (const bad of ["whatever", "2026-13", "2026-00", "26-09", "", "2026-9", null]) {
    assert.equal(
      paymentSchema.safeParse({ ...money, month: bad, memberId: "m1" }).success,
      false,
      `"${bad}" must not be accepted as a month`,
    );
  }
});

test("an unknown expense category is rejected", () => {
  const base = { date: "2026-09-01", description: "Rice", amount: 500 };
  assert.equal(expenseSchema.safeParse({ ...base, category: "BAZAR" }).success, true);
  assert.equal(expenseSchema.safeParse({ ...base, category: "MADE_UP" }).success, false);
  assert.equal(
    expenseSchema.safeParse({ ...base, category: "BAZAR", amount: 0 }).success,
    false,
    "an expense must cost something",
  );
  assert.equal(
    expenseSchema.safeParse({ ...base, category: "BAZAR", amount: -5 }).success,
    false,
  );
});

test("member phone and status are constrained", () => {
  const base = { name: "Bablu", phone: "+880 1700 000000", joiningDate: "2026-01-05" };
  assert.equal(memberSchema.safeParse(base).success, true);
  assert.equal(memberSchema.safeParse({ ...base, phone: "12345" }).success, false);
  assert.equal(memberSchema.safeParse({ ...base, phone: "call me" }).success, false);
  assert.equal(memberSchema.safeParse({ ...base, status: "SLEEPING" }).success, false);
});

test("bills accept zero and custom bills do not", () => {
  assert.equal(billSchema.safeParse({ month: "2026-09", water: 0 }).success, true);
  assert.equal(billSchema.safeParse({ month: "2026-09", water: -1 }).success, false);
  assert.equal(
    customBillSchema.safeParse({ month: "2026-09", title: "Cook", amount: 10 }).success,
    true,
  );
  assert.equal(
    customBillSchema.safeParse({ month: "2026-09", title: "Cook", amount: 0 }).success,
    false,
  );
});

test("mess settings only accept a known currency", () => {
  assert.equal(messSettingsSchema.safeParse({ name: "Green Villa", currency: "BDT" }).success, true);
  assert.equal(messSettingsSchema.safeParse({ name: "Green Villa", currency: "XYZ" }).success, false);
});

console.log(`\n${passed} passed, ${process.exitCode ? "some failed" : "all green"}`);
