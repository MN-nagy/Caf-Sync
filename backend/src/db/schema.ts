import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";

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
  imageUrl: varchar("image_url", { length: 1000 }),
});

// 2. The Main Ticket (Orders)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(), // e.g., Order #1042
  tableNumber: integer("table_number"), // Null if it's a pickup order
  isPickup: boolean("is_pickup").default(false), // True if passing by
  totalPiastres: integer("total_piastres").notNull(),
  status: text("status", {
    enum: ["pending", "active", "ready", "completed", "cancelled"],
  }).default("active"),
  customerPhone: varchar("customer_phone", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. The Connector (Items inside the order)
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(), // Links to the Ticket
  drinkId: integer("drink_id")
    .references(() => drinks.id)
    .notNull(), // Links to the Drink Catalog
  quantity: integer("quantity").notNull().default(1),
});

export const kitchenSettings = pgTable("kitchen_settings", {
  id: serial("id").primaryKey(),
  kitchenEmail: text("kitchen_email").notNull().unique(),
  kitchenPassword: text("kitchen__password_hash").notNull(), // The meat-grinder version of the password
  kitchenPinHash: text("kitchen_pin_hash").notNull(), // The meat-grinder version of the 4-digit PIN
  updatedAt: timestamp("updated_at").defaultNow(),
});
