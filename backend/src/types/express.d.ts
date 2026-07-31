import { JwtPayload } from "jsonwebtoken";

export interface AuthPayload extends JwtPayload {
  sub: number;
  role: "manager" | "barista";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
