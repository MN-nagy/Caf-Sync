import { Router } from "express";
import { login, verifyPin, logout } from "../controllers/auth.controller.ts";
import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 min per IP
  message: { success: false, message: "Too many attempts, try again later" },
});

const authRouter = Router();

authRouter.use(rateLimiter);

authRouter.post("/login", login);
authRouter.post("/verify-pin", verifyPin);
authRouter.post("/logout", logout);

export default authRouter;
