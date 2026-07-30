import { Router } from "express";
import {
  addOrder,
  getActiveOrders,
  updateOrderStatus,
} from "../controllers/order.controller.ts";
import { requireShift } from "../middleware/auth.middleware.ts";

const orderRouter = Router();

orderRouter.post("/", addOrder);
orderRouter.get("/active", requireShift, getActiveOrders); // Fetches the queue
orderRouter.patch("/:id/complete", requireShift, updateOrderStatus); // Updates the status

export default orderRouter;
