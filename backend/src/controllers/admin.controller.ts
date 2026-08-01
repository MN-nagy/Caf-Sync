import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { drinks, orders, orderItems } from "../db/schema.ts";
import { eq, sql, desc, gte, and, ne } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcrypt";
import { asc } from "drizzle-orm";
import { adminCredentials, cafeTables } from "../db/schema.ts";

const updateDrinkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(255).optional(),
  priceInPiastres: z.number().int().positive().optional(),
  originalPriceInPiastres: z.number().int().positive().nullable().optional(),
  isOutOfStock: z.boolean().optional(),
});

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createDrinkSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(255),
  priceInPiastres: z.number().int().positive(),
  originalPriceInPiastres: z.number().int().positive().nullable().optional(),
});

const createTableSchema = z.object({ number: z.number().int().positive() });
const tableIdSchema = z.object({ id: z.coerce.number().int().positive() });
const toggleTableSchema = z.object({ isActive: z.boolean() });
const changePinSchema = z.object({
  newPin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const updateDrinkInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const data = updateDrinkSchema.parse(req.body);

    // Fetch the current row so we can validate against the merged
    // result, not just whatever fields happen to be in this PATCH.
    const [currentDrink] = await db
      .select()
      .from(drinks)
      .where(eq(drinks.id, id));

    if (!currentDrink) {
      res.status(404).json({ success: false, message: "Drink not found" });
      return;
    }

    const mergedPrice = data.priceInPiastres ?? currentDrink.priceInPiastres;
    const mergedOriginalPrice =
      data.originalPriceInPiastres !== undefined
        ? data.originalPriceInPiastres
        : currentDrink.originalPriceInPiastres;

    // A "was" price only makes sense if it's actually higher than
    // what's charged. null/undefined means "no discount" and is fine.
    if (mergedOriginalPrice != null && mergedOriginalPrice <= mergedPrice) {
      res.status(400).json({
        success: false,
        message:
          "originalPriceInPiastres must be higher than priceInPiastres to represent a discount",
      });
      return;
    }

    const updatedDrink = await db
      .update(drinks)
      .set(data)
      .where(eq(drinks.id, id))
      .returning();

    if (!updatedDrink.length) {
      res.status(404).json({ success: false, message: "Drink not found" });
      return;
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("drink:updated", updatedDrink[0]);
    }

    res.json({ success: true, data: updatedDrink[0] });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------
// 2. ANALYTICS & STATS ROUTES
// ---------------------------------------------------------

export const getStats = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // STAT 1: Daily Orders & Revenue
    const dailyStats = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        orderCount: sql<number>`CAST(COUNT(${orders.id}) AS INT)`,
        revenuePiastres: sql<number>`CAST(SUM(${orders.totalPiastres}) AS INT)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, sixtyDaysAgo),
          ne(orders.status, "cancelled"),
        ),
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    // STAT 2: Item Popularity
    const itemPopularity = await db
      .select({
        name: drinks.name,
        salesCount: sql<number>`CAST(SUM(${orderItems.quantity}) AS INT)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(drinks, eq(orderItems.drinkId, drinks.id))
      .where(
        and(
          gte(orders.createdAt, sixtyDaysAgo),
          ne(orders.status, "cancelled"),
        ),
      )
      .groupBy(drinks.name)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(10);

    // STAT 3: Peak Activity Hours
    const peakHours = await db
      .select({
        hour: sql<number>`CAST(EXTRACT(HOUR FROM ${orders.createdAt}) AS INT)`,
        orderCount: sql<number>`CAST(COUNT(${orders.id}) AS INT)`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, sixtyDaysAgo),
          ne(orders.status, "cancelled"),
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    const formattedPeakHours = Array.from({ length: 24 }, (_, i) => {
      const found = peakHours.find((p) => p.hour === i);
      return {
        hour: `${i === 0 ? 12 : i > 12 ? i - 12 : i} ${i >= 12 ? "PM" : "AM"}`,
        orderCount: found ? found.orderCount : 0,
      };
    });

    res.json({
      dailyStats,
      itemPopularity,
      peakHours: formattedPeakHours,
    });
  } catch (error) {
    next(error);
  }
};

// --- MENU: ADD / ARCHIVE ---

export const createDrink = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = createDrinkSchema.parse(req.body);
    if (
      data.originalPriceInPiastres != null &&
      data.originalPriceInPiastres <= data.priceInPiastres
    ) {
      res.status(400).json({
        success: false,
        message: "originalPriceInPiastres must be higher than priceInPiastres",
      });
      return;
    }
    const [newDrink] = await db
      .insert(drinks)
      .values({ ...data, isArchived: false })
      .returning();
    res.status(201).json({ success: true, data: newDrink });
  } catch (error) {
    next(error);
  }
};

export const archiveDrink = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const [archived] = await db
      .update(drinks)
      .set({ isArchived: true })
      .where(eq(drinks.id, id))
      .returning();
    if (!archived) {
      res.status(404).json({ success: false, message: "Drink not found" });
      return;
    }
    res.json({ success: true, data: archived });
  } catch (error) {
    next(error);
  }
};

// --- TABLES ---

export const listTables = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const allTables = await db
      .select()
      .from(cafeTables)
      .orderBy(asc(cafeTables.number));
    res.json(allTables);
  } catch (error) {
    next(error);
  }
};

export const createTable = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { number } = createTableSchema.parse(req.body);
    const [existing] = await db
      .select()
      .from(cafeTables)
      .where(eq(cafeTables.number, number));
    if (existing) {
      res
        .status(409)
        .json({ success: false, message: `Table ${number} already exists` });
      return;
    }
    const [newTable] = await db
      .insert(cafeTables)
      .values({ number, isActive: true })
      .returning();
    res.status(201).json({ success: true, data: newTable });
  } catch (error) {
    next(error);
  }
};

export const toggleTable = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = tableIdSchema.parse(req.params);
    const { isActive } = toggleTableSchema.parse(req.body);
    const [updated] = await db
      .update(cafeTables)
      .set({ isActive })
      .where(eq(cafeTables.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ success: false, message: "Table not found" });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteTable = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = tableIdSchema.parse(req.params);
    const deleted = await db
      .delete(cafeTables)
      .where(eq(cafeTables.id, id))
      .returning({ id: cafeTables.id });
    if (!deleted.length) {
      res.status(404).json({ success: false, message: "Table not found" });
      return;
    }
    res.json({ success: true, message: "Table removed" });
  } catch (error) {
    next(error);
  }
};

// --- KITCHEN PIN ---

export const changeKitchenPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { newPin } = changePinSchema.parse(req.body);
    const [account] = await db.select().from(adminCredentials).limit(1);
    if (!account) {
      res
        .status(500)
        .json({ success: false, message: "Kitchen settings missing" });
      return;
    }
    const newPinHash = await bcrypt.hash(newPin, 10);
    await db
      .update(adminCredentials)
      .set({ kitchenPinHash: newPinHash, updatedAt: new Date() })
      .where(eq(adminCredentials.id, account.id));
    res.json({ success: true, message: "Kitchen PIN updated" });
  } catch (error) {
    next(error);
  }
};
