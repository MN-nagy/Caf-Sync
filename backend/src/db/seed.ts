import { db } from "./index.ts";
import { drinks, orders, orderItems } from "./schema.ts";

const seedDrinks = [
  {
    name: "Cortado",
    description:
      "Equal parts double espresso and steamed milk for a robust finish.",
    priceInPiastres: 7500,
    category: "Hot Coffee",
  },
  {
    name: "Flat White",
    description: "Double ristretto with micro-foamed milk.",
    priceInPiastres: 8500,
    category: "Hot Coffee",
  },
  {
    name: "V60 Pour Over",
    description: "Single origin Ethiopian beans, bright and fruity notes.",
    priceInPiastres: 11000,
    category: "Hot Coffee",
  },
  {
    name: "Double Turkish Coffee",
    description: "Authentic, rich, and unfiltered. Made to order.",
    priceInPiastres: 6000,
    category: "Hot Coffee",
  },
  {
    name: "Iced Spanish Latte",
    description: "Espresso, milk, and sweetened condensed milk over ice.",
    priceInPiastres: 10500,
    originalPriceInPiastres: 13000,
    category: "Iced Coffee",
  },
  {
    name: "Cold Brew (24h)",
    description: "Steeped slowly for a smooth, zero-acidity kick.",
    priceInPiastres: 9500,
    category: "Iced Coffee",
  },
  {
    name: "Iced Pistachio Latte",
    description: "Our signature espresso blended with rich pistachio cream.",
    priceInPiastres: 14500,
    category: "Iced Coffee",
  },
  {
    name: "Lotus Biscoff Frappe",
    description:
      "Blended with real Lotus spread, topped with whipped cream and biscuit crumble.",
    priceInPiastres: 15000,
    category: "Frappe",
  },
  {
    name: "Mocha Frappe",
    description: "Rich dark chocolate, espresso, and milk blended with ice.",
    priceInPiastres: 11500,
    originalPriceInPiastres: 14000,
    category: "Frappe",
  },
];

async function runSeed() {
  console.log("🌱 Starting Database Reset & Seed...");
  try {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(drinks);
    await db.insert(drinks).values(seedDrinks);
    console.log(
      "✅ Database successfully seeded with typography-focused menu!",
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

runSeed();
