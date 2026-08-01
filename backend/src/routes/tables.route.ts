import { Router } from "express";
import { getActiveTables } from "../controllers/tables.controller.ts";

const tablesRouter = Router();
tablesRouter.get("/", getActiveTables);
export default tablesRouter;
