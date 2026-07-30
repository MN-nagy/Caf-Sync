import { Router } from "express";
import {
  addOrder,
  getActiveOrders,
  updateOrderStatus,
  updateOrderPhone,
} from "../controllers/order.controller.ts";
import { requireShift } from "../middleware/auth.middleware.ts";

const orderRouter = Router();

orderRouter.post("/", addOrder);
orderRouter.get("/active", requireShift, getActiveOrders); // Fetches the queue
orderRouter.patch("/:id/status", requireShift, updateOrderStatus); // Updates the status
orderRouter.patch("/:id/phone", updateOrderPhone);

export default orderRouter;
