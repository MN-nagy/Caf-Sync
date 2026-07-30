import { Router } from "express";
import { getMenu } from "../controllers/menu.controller.ts";

const menuRouter = Router();

menuRouter.get("/", getMenu);

export default menuRouter;
