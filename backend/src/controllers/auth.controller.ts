import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/index.ts";
import { kitchenSettings } from "../db/schema.ts";
import { eq } from "drizzle-orm";

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}
const JWT_SECRET = process.env.JWT_SECRET;

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
      return;
    }

    // 1. Find the kitchen account by email
    const [account] = await db
      .select()
      .from(kitchenSettings)
      .where(eq(kitchenSettings.kitchenEmail, email));

    if (!account) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const isMatch = await bcrypt.compare(password, account.kitchenPassword);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    // 3. Success! Generate the 30-Day Device Token (The Wax Seal)
    const deviceToken = jwt.sign({ role: "manager_kitchen" }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.cookie("deviceToken", deviceToken, {
      httpOnly: true, // prevents JavaScript/XSS theft
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // protection against CSRF
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
    });

    res.json({ success: true, message: "Logged in successfully" });
  } catch (error) {
    next(error);
  }
};

export const verifyPin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { pin } = req.body;

    // Since there's only one store setup, we just grab the first row
    const [account] = await db.select().from(kitchenSettings).limit(1);

    if (!account) {
      res
        .status(500)
        .json({ success: false, message: "Kitchen settings missing" });
      return;
    }

    // Compare the raw PIN to the hashed PIN
    const isMatch = await bcrypt.compare(pin, account.kitchenPinHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Invalid PIN" });
      return;
    }

    const shiftToken = jwt.sign(
      { sub: account.id, role: "barista" },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    // Generate the 24-Hour Shift Token
    res.cookie("shiftToken", shiftToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ success: true, message: "Shift started" });
  } catch (error) {
    next(error);
  }
};
