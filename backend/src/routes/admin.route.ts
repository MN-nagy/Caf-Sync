import { Router } from "express";
import { requireManager } from "../middleware/auth.middleware.ts";
import {
  updateDrinkInfo,
  getStats,
  createDrink,
  archiveDrink,
  listTables,
  createTable,
  toggleTable,
  deleteTable,
  changeKitchenPin,
} from "../controllers/admin.controller.ts";

const adminRouter = Router();

adminRouter.use(requireManager); // applies middleware to every route under

adminRouter.get("/stats", getStats);
adminRouter.patch("/menu/:id", updateDrinkInfo);
adminRouter.post("/menu", createDrink);
adminRouter.delete("/menu/:id", archiveDrink);

adminRouter.get("/tables", listTables);
adminRouter.post("/tables", createTable);
adminRouter.patch("/tables/:id", toggleTable);
adminRouter.delete("/tables/:id", deleteTable);

adminRouter.patch("/pin", changeKitchenPin);

export default adminRouter;
