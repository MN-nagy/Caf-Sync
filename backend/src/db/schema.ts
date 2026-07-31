import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "active",
  "ready",
  "completed",
  "cancelled",
]);

// 1. The Menu (Drinks)
export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Iced Spanish Latte"
  description: text("description"), // e.g., "Espresso and milk..."
  priceInPiastres: integer("price_in_piastres").notNull(), // See note below!
  isOutOfStock: boolean("is_out_of_stock").default(false), // Admin can flip this

  // new
  originalPriceInPiastres: integer("original_price_in_piastres"),
  category: varchar("category", { length: 255 }),
});

// 2. The Main Ticket (Orders)
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    tableNumber: integer("table_number"),
    isPickup: boolean("is_pickup").default(false),
    totalPiastres: integer("total_piastres").notNull(),
    status: text("status", {
      enum: ["pending", "active", "ready", "completed", "cancelled"],
    }).default("active"),
    customerPhone: varchar("customer_phone", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("orders_created_at_idx").on(table.createdAt)], // ← array, not object
);

// 3. The Connector (Items inside the order)
export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    drinkId: integer("drink_id")
      .references(() => drinks.id)
      .notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_drink_id_idx").on(table.drinkId),
  ],
);

export const adminCredentials = pgTable("admin_credentials", {
  id: serial("id").primaryKey(),
  kitchenEmail: text("kitchen_email").notNull().unique(),
  kitchenPassword: text("kitchen_password_hash").notNull(), // The meat-grinder version of the password
  kitchenPinHash: text("kitchen_pin_hash").notNull(), // The meat-grinder version of the 4-digit PIN
  updatedAt: timestamp("updated_at").defaultNow(),
});
