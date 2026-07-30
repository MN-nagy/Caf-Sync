import { Router } from "express";
import { login, verifyPin } from "../controllers/auth.controller.ts";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/verify-pin", verifyPin);

export default authRouter;
