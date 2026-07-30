import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "../types/express.d.ts";

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * STRICT SHIFT AUTH (Hybrid Double-Lock):
 * Requires BOTH a valid 30-day device token AND an active 24-hour shift PIN token.
 */
export const requireShift = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const deviceToken = req.cookies?.deviceToken;
    const shiftToken = req.cookies?.shiftToken;

    // 1. Check Device Lock (Manager must have logged into this device)
    if (!deviceToken) {
      res.status(401).json({
        success: false,
        code: "DEVICE_UNAUTHORIZED",
        message:
          "Device not enrolled. Manager must log in with email/password.",
      });
      return;
    }

    jwt.verify(deviceToken, JWT_SECRET); // Ensures device token isn't forged/expired

    // 2. Check Shift Lock (Barista MUST have entered PIN within last 24h)
    if (!shiftToken) {
      res.status(401).json({
        success: false,
        code: "SHIFT_EXPIRED",
        message: "Shift expired. Please enter PIN to unlock kitchen display.",
      });
      return;
    }

    // Verify shift token and attach user payload
    const decodedShift = jwt.verify(
      shiftToken,
      JWT_SECRET,
    ) as unknown as AuthPayload;
    req.user = decodedShift;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        code: "SHIFT_EXPIRED",
        message: "Session expired. Please enter PIN again.",
      });
      return;
    }

    res.status(401).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Invalid session or corrupt token.",
    });
  }
};
