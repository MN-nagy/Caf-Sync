import type { Request, Response, NextFunction } from "express";
import { drinks, orders, orderItems } from "../db/schema.ts";
import { db } from "../db/index.ts";
import { eq, asc, inArray } from "drizzle-orm";
import { z } from "zod";

const orderItemSchema = z.object({
  drinkId: z.number().int().positive(),
  quantity: z.number().int().positive().max(50), // sane upper bound, adjust as needed
});

const addOrderSchema = z
  .object({
    isPickup: z.boolean(),
    tableNumber: z.coerce.number().int().positive().nullable().optional(),
    customerPhone: z.string().min(5).max(20).nullish(),
    items: z.array(orderItemSchema).min(1),
  })
  .refine((data) => !data.isPickup || !!data.customerPhone, {
    message: "customerPhone is required for pickup orders",
    path: ["customerPhone"],
  });

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const statusSchema = z.object({
  status: z.enum(["pending", "active", "ready", "completed", "cancelled"]),
});

const phoneSchema = z.object({
  customerPhone: z.string().min(5).max(20),
});

export const addOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { isPickup, tableNumber, items, customerPhone } =
      addOrderSchema.parse(req.body);

    const generatedOrderId = await db.transaction(async (tx) => {
      const drinkIds = items.map((item) => item.drinkId);

      const menuItems = await tx
        .select({
          id: drinks.id,
          price: drinks.priceInPiastres,
          isOutOfStock: drinks.isOutOfStock,
        })
        .from(drinks)
        .where(inArray(drinks.id, drinkIds));

      const priceMap = new Map(menuItems.map((d) => [d.id, d]));

      // Server computes the total from actual DB prices — never trust
      // a total sent by the client.
      let computedTotal = 0;
      for (const item of items) {
        const drink = priceMap.get(item.drinkId);
        if (!drink) {
          throw new Error(`Invalid drink ID: ${item.drinkId}`);
        }
        if (drink.isOutOfStock) {
          throw new Error(`Drink ID ${item.drinkId} is out of stock`);
        }
        computedTotal += drink.price * item.quantity;
      }

      const [newOrder] = await tx
        .insert(orders)
        .values({
          tableNumber: tableNumber ?? null,
          isPickup,
          totalPiastres: computedTotal,
          customerPhone: isPickup ? customerPhone : null,
          status: isPickup ? "pending" : "active",
        })
        .returning({ id: orders.id });

      if (!newOrder) {
        throw new Error("Failed to create new order");
      }

      const itemsToInsert = items.map((item) => ({
        orderId: newOrder.id,
        drinkId: item.drinkId,
        quantity: item.quantity,
      }));

      await tx.insert(orderItems).values(itemsToInsert);

      return newOrder.id;
    });

    const io = req.app.get("io");
    if (io) {
      io.of("/kitchen").emit("order:created", {
        orderId: generatedOrderId,
        tableNumber,
        isPickup,
        customerPhone,
        status: isPickup ? "pending" : "active",
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
    const rows = await db
      .select({
        orderId: orders.id,
        tableNumber: orders.tableNumber,
        isPickup: orders.isPickup,
        status: orders.status,
        customerPhone: orders.customerPhone,
        drinkName: drinks.name,
        quantity: orderItems.quantity,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(drinks, eq(orderItems.drinkId, drinks.id))
      .where(inArray(orders.status, ["pending", "active", "ready"]))
      .orderBy(asc(orders.createdAt));

    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.orderId)) {
        ordersMap.set(row.orderId, {
          orderId: row.orderId,
          tableNumber: row.tableNumber,
          isPickup: row.isPickup,
          customerPhone: row.customerPhone,
          status: row.status,
          items: [],
        });
      }

      if (row.drinkName) {
        ordersMap.get(row.orderId).items.push({
          drinkName: row.drinkName,
          quantity: row.quantity,
        });
      }
    }

    const formattedOrders = Array.from(ordersMap.values());
    res.status(200).json(formattedOrders);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: orderId } = idParamSchema.parse(req.params);
    const { status } = statusSchema.parse(req.body);

    const updated = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });

    if (!updated.length) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const io = req.app.get("io");
    if (io) {
      io.of("/kitchen").emit("order:updated", { orderId, status });
    }

    res.json({
      success: true,
      message: `Order #${orderId} is now ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderPhone = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: orderId } = idParamSchema.parse(req.params);
    const { customerPhone } = phoneSchema.parse(req.body);

    const updated = await db
      .update(orders)
      .set({ customerPhone })
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });

    if (!updated.length) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    res.json({ success: true, message: "Phone updated" });
  } catch (error) {
    next(error);
  }
};
