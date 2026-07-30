import { Router } from "express";
import {
  addOrder,
  getActiveOrders,
  markOrderComplete,
} from "../controllers/order.controller.ts";

const orderRouter = Router();

orderRouter.post("/", addOrder);
orderRouter.get("/active", getActiveOrders); // Fetches the queue
orderRouter.patch("/:id/complete", markOrderComplete); // Updates the status

export default orderRouter;
