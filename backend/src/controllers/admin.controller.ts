import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { drinks, orders, orderItems } from "../db/schema.ts";
import { eq, sql, desc, gte } from "drizzle-orm";
import { z } from "zod";

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
      .where(gte(orders.createdAt, sixtyDaysAgo))
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
      .where(gte(orders.createdAt, sixtyDaysAgo))
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
      .where(gte(orders.createdAt, sixtyDaysAgo))
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
