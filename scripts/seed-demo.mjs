import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EMAIL = "e2e-probe@test.local";
const MONTH = "2026-09";

const user = await db.user.findUnique({
  where: { email: EMAIL },
  select: { id: true, mess: { select: { id: true, name: true } } },
});

if (!user) {
  console.error(`No probe user ${EMAIL}. Run scripts/seed-probe.mjs first.`);
  process.exit(1);
}

const messId = user.mess.id;
console.log(`seeding ${user.mess.name} (${messId}) for ${MONTH}`);

// --- wipe anything from a previous run -------------------------------------
await db.payment.deleteMany({ where: { messId } });
await db.meal.deleteMany({ where: { messId } });
await db.customBill.deleteMany({ where: { messId } });
await db.bill.deleteMany({ where: { messId } });
await db.expense.deleteMany({ where: { messId } });
await db.member.deleteMany({ where: { messId } });

// --- members ---------------------------------------------------------------
const roster = [
  { name: "Asha Rahman", phone: "01711-000001", rent: 4500, status: "ACTIVE", joined: 1 },
  { name: "Bablu Mia", phone: "01711-000002", rent: 5000, status: "ACTIVE", joined: 1 },
  { name: "Chen Wei", phone: "01711-000003", rent: 4500, status: "ACTIVE", joined: 4 },
  { name: "Dina Akter", phone: "01711-000004", rent: 5000, status: "ACTIVE", joined: 1 },
  { name: "Emran Hossain", phone: "01711-000005", rent: 4500, status: "ACTIVE", joined: 12 },
  { name: "Farhana Noor", phone: "01711-000006", rent: 4500, status: "INACTIVE", joined: 1 },
  { name: "Gani Miah", phone: "01711-000007", rent: 4000, status: "ARCHIVED", joined: 1 },
];

const members = [];
for (const person of roster) {
  const { joined, ...fields } = person;
  members.push(
    await db.member.create({
      data: {
        ...fields,
        messId,
        joiningDate: new Date(Date.UTC(2026, 7, joined)),
      },
      select: { id: true, name: true, status: true, rent: true },
    }),
  );
}
console.log(`  members: ${members.length}`);

// --- expenses --------------------------------------------------------------
const expenses = [
  { description: "Weekly bazar — chicken & vegetables", category: "BAZAR", amount: 3450, day: 2 },
  { description: "Weekly bazar — rice, oil, lentils", category: "BAZAR", amount: 4120, day: 6 },
  { description: "Fish", category: "BAZAR", amount: 1850, day: 9 },
  { description: "Bazar — weekend stock", category: "BAZAR", amount: 5230, day: 13 },
  { description: "Bazar — meat & eggs", category: "BAZAR", amount: 2980, day: 16 },
  { description: "Bazar — final stock", category: "BAZAR", amount: 3760, day: 20 },
  { description: "Bazar — top-up", category: "BAZAR", amount: 4410, day: 24 },
  { description: "Maid salary", category: "CLEANING", amount: 3000, day: 5 },
  { description: "Gas cylinder x2", category: "GAS_CYLINDER", amount: 2600, day: 8 },
  { description: "Fridge repair", category: "MAINTENANCE", amount: 1800, day: 18 },
  { description: "Dishwasher rack", category: "FURNITURE", amount: 950, day: 22 },
];
for (const item of expenses) {
  await db.expense.create({
    data: {
      messId,
      description: item.description,
      category: item.category,
      amount: item.amount,
      date: new Date(Date.UTC(2026, 8, item.day)),
    },
  });
}
console.log(`  expenses: ${expenses.length}`);

// --- meals -----------------------------------------------------------------
const active = members.filter((m) => m.status === "ACTIVE");
const away = new Map([["Chen Wei", [7, 8]], ["Emran Hossain", [14, 15, 16]]]);

let mealRows = 0;
for (let day = 1; day <= 26; day += 1) {
  for (const member of members) {
    if (member.status === "ARCHIVED") continue;

    const isAway = away.get(member.name)?.includes(day);
    if (isAway) {
      await db.meal.create({
        data: { messId, memberId: member.id, date: new Date(Date.UTC(2026, 8, day)), breakfast: 0, lunch: 0, dinner: 0 },
      });
      mealRows += 1;
      continue;
    }

    // A little variety so the report does not look synthetic.
    const breakfast = day % 7 === 0 ? 0 : 1;
    const lunch = 1;
    const dinner = member.status === "INACTIVE" ? 0.5 : day % 5 === 0 ? 0.5 : 1;

    await db.meal.create({
      data: {
        messId,
        memberId: member.id,
        date: new Date(Date.UTC(2026, 8, day)),
        breakfast,
        lunch,
        dinner,
      },
    });
    mealRows += 1;
  }
}
console.log(`  meal rows: ${mealRows} across ${active.length} paying members`);

// --- utility bill + a custom extra -----------------------------------------
await db.bill.create({
  data: {
    messId,
    month: MONTH,
    water: 850,
    electricity: 2340,
    gas: 640,
    wifi: 1200,
    other: 0,
  },
});
await db.customBill.createMany({
  data: [
    { messId, month: MONTH, title: "Cook salary", amount: 4500 },
    { messId, month: MONTH, title: "Waste collection", amount: 300 },
  ],
});
console.log("  bills: 1 utility bill + 2 custom charges");

// --- payments (mostly settled, two outstanding) ----------------------------
await db.payment.createMany({
  data: [
    { messId, month: MONTH, memberId: members[0].id, rentPaid: 4500, mealPaid: 0, utilityPaid: 0 },
    { messId, month: MONTH, memberId: members[1].id, rentPaid: 5000, mealPaid: 0, utilityPaid: 0 },
    { messId, month: MONTH, memberId: members[2].id, rentPaid: 3000, mealPaid: 0, utilityPaid: 0 },
    { messId, month: MONTH, memberId: members[3].id, rentPaid: 5000, mealPaid: 0, utilityPaid: 0 },
    { messId, month: MONTH, memberId: members[4].id, rentPaid: 4500, mealPaid: 1500, utilityPaid: 0 },
  ],
});
console.log("  payments: 5 recorded (2 members outstanding)");

await db.$disconnect();
console.log("\ndone");
