import { db } from "./index.ts";
import {
  drinks,
  orders,
  orderItems,
  adminCredentials,
  cafeTables,
} from "./schema.ts";
import bcrypt from "bcrypt";

// --- TEST CREDENTIALS (printed at the end too) ---
const MANAGER_EMAIL = "manager@cafe.com";
const MANAGER_PASSWORD = "TestPassword123!";
const KITCHEN_PIN = "1234";

const seedDrinks = [
  {
    name: "Cortado",
    description:
      "Equal parts double espresso and steamed milk for a robust finish.",
    priceInPiastres: 7500,
    category: "Hot Coffee",
    isArchived: false,
  },
  {
    name: "Flat White",
    description: "Double ristretto with micro-foamed milk.",
    priceInPiastres: 8500,
    category: "Hot Coffee",
    isArchived: false,
  },
  {
    name: "V60 Pour Over",
    description: "Single origin Ethiopian beans, bright and fruity notes.",
    priceInPiastres: 11000,
    category: "Hot Coffee",
    isArchived: false,
  },
  {
    name: "Double Turkish Coffee",
    description: "Authentic, rich, and unfiltered. Made to order.",
    priceInPiastres: 6000,
    category: "Hot Coffee",
    isArchived: false,
  },
  {
    name: "Iced Spanish Latte",
    description: "Espresso, milk, and sweetened condensed milk over ice.",
    priceInPiastres: 10500,
    originalPriceInPiastres: 13000,
    category: "Iced Coffee",
    isArchived: false,
  },
  {
    name: "Cold Brew (24h)",
    description: "Steeped slowly for a smooth, zero-acidity kick.",
    priceInPiastres: 9500,
    category: "Iced Coffee",
    isArchived: false,
  },
  {
    name: "Iced Pistachio Latte",
    description: "Our signature espresso blended with rich pistachio cream.",
    priceInPiastres: 14500,
    category: "Iced Coffee",
    // Deliberately out of stock — for testing the "sold out" flow /
    // the specific-error-message fix in addOrder.
    isOutOfStock: true,
    isArchived: false,
  },
  {
    name: "Lotus Biscoff Frappe",
    description:
      "Blended with real Lotus spread, topped with whipped cream and biscuit crumble.",
    priceInPiastres: 15000,
    category: "Frappe",
    isArchived: false,
  },
  {
    name: "Mocha Frappe",
    description: "Rich dark chocolate, espresso, and milk blended with ice.",
    priceInPiastres: 11500,
    originalPriceInPiastres: 14000,
    category: "Frappe",
    isArchived: false,
  },
  {
    name: "Retired Seasonal Pumpkin Latte",
    description: "Last season's special — kept for order history only.",
    priceInPiastres: 12000,
    category: "Hot Coffee",
    // Already archived — for testing that getMenu correctly hides it
    // and that it doesn't show up in the Admin menu-manager list.
    isArchived: true,
  },
];

// Random date within the last N days, used to spread historical orders
// out across the stats window (so the orders-chart and monthly-revenue
// stat both have something real to show).
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(
    9 + Math.floor(Math.random() * 10),
    Math.floor(Math.random() * 60),
  );
  return d;
}

async function runSeed() {
  console.log("🌱 Resetting & seeding database for testing...");

  try {
    // Delete in FK-safe order
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(drinks);
    await db.delete(cafeTables);
    await db.delete(adminCredentials);

    // --- MENU ---
    const insertedDrinks = await db
      .insert(drinks)
      .values(seedDrinks)
      .returning();
    const drinkByName = (name: string) =>
      insertedDrinks.find((d) => d.name === name)!;

    // --- TABLES ---
    // Table 5 seeded inactive, to test the toggle-off flow (should be
    // hidden from the customer-facing picker, still visible in Admin).
    const tableRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(
      (number) => ({
        number,
        isActive: number !== 5,
      }),
    );
    await db.insert(cafeTables).values(tableRows);

    // --- MANAGER / KITCHEN AUTH ---
    const passwordHash = await bcrypt.hash(MANAGER_PASSWORD, 10);
    const pinHash = await bcrypt.hash(KITCHEN_PIN, 10);
    await db.insert(adminCredentials).values({
      kitchenEmail: MANAGER_EMAIL,
      kitchenPassword: passwordHash,
      kitchenPinHash: pinHash,
    });

    // --- HISTORICAL ORDERS (for Admin stats: 60-day chart + monthly revenue) ---
    // Spread across ~50 days so some fall in previous months and some
    // fall in the current month, with a mix of statuses.
    const historical = [
      { daysAgo: 50, status: "completed" as const },
      { daysAgo: 45, status: "completed" as const },
      { daysAgo: 38, status: "cancelled" as const },
      { daysAgo: 30, status: "completed" as const },
      { daysAgo: 22, status: "completed" as const },
      { daysAgo: 15, status: "completed" as const },
      { daysAgo: 9, status: "completed" as const },
      { daysAgo: 5, status: "completed" as const },
      { daysAgo: 3, status: "completed" as const },
      { daysAgo: 1, status: "completed" as const },
      { daysAgo: 0, status: "completed" as const },
    ];

    for (const h of historical) {
      const isPickup = Math.random() > 0.5;
      const items = [
        {
          drink: drinkByName("Cortado"),
          quantity: 1 + Math.floor(Math.random() * 2),
        },
        { drink: drinkByName("Iced Spanish Latte"), quantity: 1 },
      ];
      const total = items.reduce(
        (sum, i) => sum + i.drink.priceInPiastres * i.quantity,
        0,
      );

      const [order] = await db
        .insert(orders)
        .values({
          isPickup,
          tableNumber: isPickup ? null : 1 + Math.floor(Math.random() * 4),
          totalPiastres: total,
          status: h.status,
          customerPhone: isPickup ? "01012345678" : null,
          createdAt: daysAgo(h.daysAgo),
        })
        .returning({ id: orders.id });

      await db
        .insert(orderItems)
        .values(
          items.map((i) => ({
            orderId: order.id,
            drinkId: i.drink.id,
            quantity: i.quantity,
          })),
        );
    }

    // --- LIVE ORDERS (for testing the Kitchen display right now) ---

    // Pickup: pending (awaiting payment verification — left column)
    const [pickupPending] = await db
      .insert(orders)
      .values({
        isPickup: true,
        totalPiastres: drinkByName("Flat White").priceInPiastres * 2,
        status: "pending",
        customerPhone: "01098765432",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: pickupPending.id,
        drinkId: drinkByName("Flat White").id,
        quantity: 2,
      });

    // Pickup: active (being prepared — right column)
    const [pickupActive] = await db
      .insert(orders)
      .values({
        isPickup: true,
        totalPiastres: drinkByName("Mocha Frappe").priceInPiastres,
        status: "active",
        customerPhone: "01055566677",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: pickupActive.id,
        drinkId: drinkByName("Mocha Frappe").id,
        quantity: 1,
      });

    // Pickup: ready (top-level Ready tab)
    const [pickupReady] = await db
      .insert(orders)
      .values({
        isPickup: true,
        totalPiastres: drinkByName("Cold Brew (24h)").priceInPiastres,
        status: "ready",
        customerPhone: "01011122233",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: pickupReady.id,
        drinkId: drinkByName("Cold Brew (24h)").id,
        quantity: 1,
      });

    // Dine-in: active, table 2 (Tables tab — left column)
    const [tableActive1] = await db
      .insert(orders)
      .values({
        isPickup: false,
        tableNumber: 2,
        totalPiastres: drinkByName("V60 Pour Over").priceInPiastres,
        status: "active",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: tableActive1.id,
        drinkId: drinkByName("V60 Pour Over").id,
        quantity: 1,
      });

    // Dine-in: active, table 4 (Tables tab — left column, second card)
    const [tableActive2] = await db
      .insert(orders)
      .values({
        isPickup: false,
        tableNumber: 4,
        totalPiastres: drinkByName("Double Turkish Coffee").priceInPiastres * 2,
        status: "active",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: tableActive2.id,
        drinkId: drinkByName("Double Turkish Coffee").id,
        quantity: 2,
      });

    // Dine-in: ready, table 1 (Tables tab — right column)
    const [tableReady] = await db
      .insert(orders)
      .values({
        isPickup: false,
        tableNumber: 1,
        totalPiastres: drinkByName("Lotus Biscoff Frappe").priceInPiastres,
        status: "ready",
      })
      .returning({ id: orders.id });
    await db
      .insert(orderItems)
      .values({
        orderId: tableReady.id,
        drinkId: drinkByName("Lotus Biscoff Frappe").id,
        quantity: 1,
      });

    console.log("✅ Seed complete.\n");
    console.log("── Manager login ─────────────────────");
    console.log(`  Email:    ${MANAGER_EMAIL}`);
    console.log(`  Password: ${MANAGER_PASSWORD}`);
    console.log(`  PIN:      ${KITCHEN_PIN}`);
    console.log("───────────────────────────────────────");
    console.log(
      `Seeded ${insertedDrinks.length} drinks (1 archived, 1 out-of-stock), 8 tables (table 5 inactive), ${historical.length} historical orders, and 6 live orders across every kitchen state.`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

runSeed();
