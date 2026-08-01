import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { cafeTables } from "../db/schema.ts";
import { eq, asc } from "drizzle-orm";

export const getActiveTables = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const activeTables = await db
      .select()
      .from(cafeTables)
      .where(eq(cafeTables.isActive, true))
      .orderBy(asc(cafeTables.number));
    res.status(200).json(activeTables);
  } catch (error) {
    next(error);
  }
};
