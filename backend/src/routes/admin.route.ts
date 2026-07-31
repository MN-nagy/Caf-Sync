import { Router } from "express";
import { updateDrinkInfo, getStats } from "../controllers/admin.controller.ts";
import { requireManager } from "../middleware/auth.middleware.ts";

const adminRouter = Router();

adminRouter.use(requireManager); // applies middleware to every route under

adminRouter.patch("/menu/:id", updateDrinkInfo);
adminRouter.get("/stats", getStats);

export default adminRouter;
