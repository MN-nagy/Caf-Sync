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
orderRouter.get("/active", requireShift, getActiveOrders);
orderRouter.patch("/:id/status", requireShift, updateOrderStatus);
orderRouter.patch("/:id/phone", updateOrderPhone);

export default orderRouter;
