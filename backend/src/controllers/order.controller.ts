import type { Request, Response, NextFunction } from "express";
import { orders, orderItems } from "../db/schema.ts";
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
    const activeOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.status, "active"))
      .orderBy(asc(orders.createdAt));

    // Map them to match our frontend's IncomingOrder type
    const formattedOrders = activeOrders.map((order) => ({
      orderId: order.id,
      tableNumber: order.tableNumber,
      isPickup: order.isPickup,
    }));

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
