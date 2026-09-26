import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    passwordHash: true,
    lastLoginAt: true,
    mess: { select: { id: true, name: true, currency: true } },
  },
});

console.log(`users: ${users.length}`);
for (const u of users) {
  console.log(
    JSON.stringify(
      {
        name: u.name,
        email: u.email,
        hashPrefix: u.passwordHash?.slice(0, 7),
        hashLen: u.passwordHash?.length,
        lastLoginAt: u.lastLoginAt,
        mess: u.mess,
      },
      null,
      2,
    ),
  );
}

console.log(`members: ${await db.member.count()}`);
console.log(`meals: ${await db.meal.count()}`);

await db.$disconnect();
