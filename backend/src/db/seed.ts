import { db } from "./index.ts";
import { drinks } from "./schema.ts";

async function seed() {
  console.log("🌱 Seeding database...");

  // Remember: Prices are in Piastres! (e.g., 95 EGP = 9500 Piastres)
  const menuItems = [
    {
      name: "Cappuccino",
      description: "Rich espresso under a smooth, thick layer of milk foam.",
      priceInPiastres: 9500,
    },
    {
      name: "Flat White",
      description: "Ristretto shots of espresso with velvety steamed milk.",
      priceInPiastres: 10500,
    },
    {
      name: "Iced Spanish Latte",
      description:
        "Espresso and milk with a touch of sweetened condensed milk.",
      priceInPiastres: 12700,
    },
    {
      name: "Cold Brew",
      description: "Slow-steeped, incredibly smooth iced coffee.",
      priceInPiastres: 11000,
    },
    {
      name: "Mocha Frappe",
      description: "Blended iced coffee with rich chocolate and whipped cream.",
      priceInPiastres: 13500,
    },
  ];

  try {
    // Insert the drinks into the database
    await db.insert(drinks).values(menuItems);
    console.log("✅ Menu successfully added to Neon!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

seed();
