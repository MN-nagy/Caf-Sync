import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { drinks } from "../db/schema.ts";
import { eq } from "drizzle-orm";

export const getMenu = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const menu = await db
      .select()
      .from(drinks)
      .where(eq(drinks.isArchived, false));
    res.status(200).json(menu);
  } catch (error: any) {
    next(error);
  }
};
