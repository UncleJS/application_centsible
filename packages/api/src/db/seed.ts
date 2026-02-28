import { db, schema } from "./index";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@centsible/shared";
import { hash } from "argon2";

async function seed() {
  console.log("Seeding database...");

  // Create a demo user
  const passwordHash = await hash("demo1234");
  const [result] = await db.insert(schema.users).values({
    email: "demo@centsible.app",
    passwordHash,
    name: "Demo User",
    defaultCurrency: "GBP",
  }).$returningId();

  const userId = result.id;
  console.log(`Created demo user (id: ${userId})`);

  // Create default categories
  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
    userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    type: "expense" as const,
  }));

  const incomeCategories = DEFAULT_INCOME_CATEGORIES.map((cat) => ({
    userId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    type: "income" as const,
  }));

  await db.insert(schema.categories).values([
    ...expenseCategories,
    ...incomeCategories,
  ]);

  console.log(
    `Created ${expenseCategories.length + incomeCategories.length} default categories`
  );
  console.log("Seed complete.");
  console.log("Demo login: demo@centsible.app / demo1234");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
