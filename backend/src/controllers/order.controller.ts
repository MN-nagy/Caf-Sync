import type { Request, Response, NextFunction } from "express";
import { drinks, orders, orderItems } from "../db/schema.ts";
import { db } from "../db/index.ts";
import { eq, asc } from "drizzle-orm";

export const addOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { isPickup, tableNumber, items, totalPiastres } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: "Order must include at least one item.",
      });
      return;
    }

    const generatedOrderId = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          tableNumber: tableNumber ? parseInt(tableNumber) : null,
          isPickup,
          totalPiastres,
          // status is defaulted to "Active"
        })
        .returning({ id: orders.id });

      if (!newOrder) {
        throw new Error("Faild to create new order");
      }

      const itemsToInsert = items.map((item: any) => ({
        orderId: newOrder.id,
        drinkId: item.drinkId,
        quantity: item.quantity,
      }));

      await tx.insert(orderItems).values(itemsToInsert);

      return newOrder.id;
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("order:created", {
        orderId: generatedOrderId,
        tableNumber,
        isPickup,
        items,
      });
    }

    res.status(201).json({ success: true, orderId: generatedOrderId });
  } catch (error) {
    next(error);
  }
};

export const getActiveOrders = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. The Relational Join: Combine all 3 tables
    const rows = await db
      .select({
        orderId: orders.id,
        tableNumber: orders.tableNumber,
        isPickup: orders.isPickup,
        drinkName: drinks.name,
        quantity: orderItems.quantity,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(drinks, eq(orderItems.drinkId, drinks.id))
      .where(eq(orders.status, "active"))
      .orderBy(asc(orders.createdAt));

    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.orderId)) {
        ordersMap.set(row.orderId, {
          orderId: row.orderId,
          tableNumber: row.tableNumber,
          isPickup: row.isPickup,
          items: [],
        });
      }

      // If the order has a drink attached, push it into the array
      if (row.drinkName) {
        ordersMap.get(row.orderId).items.push({
          drinkName: row.drinkName,
          quantity: row.quantity,
        });
      }
    }

    // Convert the Map back into a standard array for the frontend
    const formattedOrders = Array.from(ordersMap.values());
    res.status(200).json(formattedOrders);
  } catch (error) {
    next(error);
  }
};

export const markOrderComplete = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      res.status(400).json({ success: false, message: "Order ID is required" });
      return;
    }

    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      res.status(400).json({
        success: false,
        message: "Invalid Order ID in makeOrderComplete",
      });
      return;
    }

    await db
      .update(orders)
      .set({ status: "completed" })
      .where(eq(orders.id, orderId));

    const io = req.app.get("io");
    if (io) {
      io.emit("order:completed", { orderId });
    }

    res.json({ success: true, message: `Order #${id} completed` });
  } catch (error) {
    next(error);
  }
};
