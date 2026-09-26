import assert from "node:assert/strict";
import { computeSettlement, sortRowsForReport } from "../src/lib/settlement.js";

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

const member = (id, name, status, rent) => ({ id, name, status, rent });
const meal = (memberId, date, breakfast, lunch, dinner) => ({
  memberId,
  date,
  breakfast,
  lunch,
  dinner,
});

console.log("settlement engine");

test("meal rate is bazar divided by total meals, charged to eaters", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 4000),
      member("b", "Bablu", "ACTIVE", 5000),
    ],
    meals: [
      meal("a", "2026-09-01", 30, 30, 30),
      meal("b", "2026-09-01", 10, 10, 10),
    ],
    expenses: [{ id: "e1", category: "BAZAR", amount: 7200, date: "2026-09-01" }],
  });

  assert.equal(result.totals.totalMeals, 120);
  assert.equal(result.totals.mealRate, 60);
  assert.equal(result.rows[0].mealCost, 5400);
  assert.equal(result.rows[1].mealCost, 1800);
});

test("half meals are supported", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [member("a", "Asha", "ACTIVE", 0)],
    meals: [meal("a", "2026-09-01", 0.5, 1, 0.5)],
    expenses: [{ id: "e1", category: "BAZAR", amount: 200, date: "2026-09-01" }],
  });

  assert.equal(result.totals.totalMeals, 2);
  assert.equal(result.totals.mealRate, 100);
  assert.equal(result.rows[0].meals.total, 2);
});

test("seat rent and shared costs are not charged to archived members", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 4000),
      member("b", "Bablu", "ARCHIVED", 5000),
    ],
    meals: [],
    expenses: [{ id: "e1", category: "CLEANING", amount: 600, date: "2026-09-02" }],
    bill: { water: 400, electricity: 0, gas: 0, wifi: 0, other: 0 },
  });

  const [asha, bablu] = result.rows;
  assert.equal(asha.rent, 4000);
  assert.equal(asha.utilities, 400);
  assert.equal(asha.otherShare, 600);
  assert.equal(asha.totalBill, 5000);

  assert.equal(bablu.rent, 0, "archived member pays no rent");
  assert.equal(bablu.utilities, 0, "archived member pays no utility share");
  assert.equal(bablu.otherShare, 0);
  assert.equal(bablu.totalBill, 0);
});

test("an inactive member is still charged for the meals they ate", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 0),
      member("b", "Bablu", "INACTIVE", 0),
    ],
    meals: [
      meal("a", "2026-09-01", 10, 0, 0),
      meal("b", "2026-09-01", 10, 0, 0),
    ],
    expenses: [{ id: "e1", category: "BAZAR", amount: 2000, date: "2026-09-01" }],
  });

  const bablu = result.rows.find((row) => row.member.id === "b");
  assert.equal(bablu.isActive, false);
  assert.equal(bablu.mealCost, 1000, "meal cost still applies");
  assert.equal(bablu.rent, 0);
  assert.equal(bablu.totalBill, 1000);
});

test("utilities include custom bills in the even split", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 0),
      member("b", "Bablu", "ACTIVE", 0),
    ],
    bill: { water: 200, electricity: 400, gas: 100, wifi: 300, other: 0 },
    customBills: [
      { id: "c1", title: "Cook salary", amount: 1000 },
      { id: "c2", title: "Waste", amount: 100 },
    ],
  });

  assert.equal(result.totals.utilityTotal, 2100);
  assert.equal(result.rows[0].utilities, 1050);
  assert.equal(
    result.totals.utilityItems.find((item) => item.label === "Cook salary").amount,
    1000,
  );
});

test("balance is bill minus payments, and drives outstanding/change", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 1000),
      member("b", "Bablu", "ACTIVE", 1000),
    ],
    payments: [
      { memberId: "a", rentPaid: 400, mealPaid: 0, utilityPaid: 0 },
      { memberId: "b", rentPaid: 1500, mealPaid: 0, utilityPaid: 0 },
    ],
  });

  assert.equal(result.rows[0].balance, 600);
  assert.equal(result.rows[1].balance, -500);
  assert.equal(result.totals.outstanding, 600);
  assert.equal(result.totals.change, 500);
  assert.equal(result.totals.totalCollected, 1900);
  assert.equal(result.totals.paidTotal, 1900);
});

test("totalCollected reflects payments, never the cost total", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [member("a", "Asha", "ACTIVE", 5000)],
    expenses: [{ id: "e1", category: "BAZAR", amount: 9000, date: "2026-09-01" }],
    payments: [{ memberId: "a", rentPaid: 1000, mealPaid: 0, utilityPaid: 0 }],
  });

  assert.equal(result.totals.grandTotal, 5000);
  assert.equal(result.totals.totalCollected, 1000);
  assert.notEqual(result.totals.totalCollected, result.totals.grandTotal);
});

test("no active members means nobody pays utilities or rent", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [member("a", "Asha", "ARCHIVED", 5000)],
    bill: { water: 300, electricity: 0, gas: 0, wifi: 0, other: 0 },
  });

  assert.equal(result.rows[0].utilities, 0);
  assert.equal(result.rows[0].totalBill, 0);
  assert.equal(result.totals.utilityTotal, 300, "the cost is still reported");
});

test("zero meals yields a zero rate instead of dividing by zero", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [member("a", "Asha", "ACTIVE", 1000)],
    expenses: [{ id: "e1", category: "BAZAR", amount: 5000, date: "2026-09-01" }],
  });

  assert.equal(result.totals.mealRate, 0);
  assert.ok(Number.isFinite(result.rows[0].totalBill));
});

test("empty input does not throw", () => {
  const result = computeSettlement({ month: "2026-09" });
  assert.equal(result.totals.grandTotal, 0);
  assert.equal(result.rows.length, 0);
  assert.equal(result.hasData, false);
});

test("report order puts active members first, then alphabetical", () => {
  const rows = computeSettlement({
    month: "2026-09",
    members: [
      member("z", "Zara", "ARCHIVED", 0),
      member("b", "Bablu", "ACTIVE", 0),
      member("a", "Asha", "ACTIVE", 0),
    ],
  }).rows;

  assert.deepEqual(
    sortRowsForReport(rows).map((row) => row.member.name),
    ["Asha", "Bablu", "Zara"],
  );
});

test("rounding adjustment reconciles the headline total with the rows", () => {
  const result = computeSettlement({
    month: "2026-09",
    members: [
      member("a", "Asha", "ACTIVE", 0),
      member("b", "Bablu", "ACTIVE", 0),
      member("c", "Chen", "ACTIVE", 0),
    ],
    meals: [
      meal("a", "2026-09-01", 7, 7, 7),
      meal("b", "2026-09-01", 5, 5, 5),
      meal("c", "2026-09-01", 3, 3, 3),
    ],
    expenses: [{ id: "e1", category: "BAZAR", amount: 1000, date: "2026-09-01" }],
  });

  const rowsTotal = result.rows.reduce((sum, row) => sum + row.totalBill, 0);
  assert.equal(
    Math.round((rowsTotal + result.roundingAdjustment) * 100) / 100,
    result.totals.grandTotal,
  );
});

console.log(`\n${passed} passed, ${process.exitCode ? "some failed" : "all green"}`);
