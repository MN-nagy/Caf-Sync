import type { Request, Response, NextFunction } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { z } from "zod";
import menuRouter from "./routes/menu.route.ts";
import orderRouter from "./routes/order.route.ts";
import authRouter from "./routes/auth.route.ts";
import adminRouter from "./routes/admin.route.ts";
import cookieParser from "cookie-parser";
import { pool } from "./db/index.ts";
import type { AuthPayload } from "./types/express.d.ts";

// Fail fast at boot if JWT_SECRET is missing, instead of discovering
// it on the first socket connection attempt.
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}
const JWT_SECRET = process.env.JWT_SECRET;

// Minimal cookie header parser — Socket.io handshake headers aren't run
// through Express's cookie-parser middleware, so we parse manually.
// Avoids depending on the `cookie` package's inconsistent TS typings
// across versions.
function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((pair) => {
      const [key, ...rest] = pair.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// middleware
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(helmet());

// API endpoints
app.use("/api/menu", menuRouter);
app.use("/api/orders", orderRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);

// websocket
app.set("io", io); // making io accessible via req.app.get("io")

// Staff-only namespace. Controllers should emit order:created /
// order:updated here (io.of("/kitchen").emit(...)) instead of on the
// default `io` — see order.controller.ts.
const kitchenNamespace = io.of("/kitchen");

kitchenNamespace.use((socket, next) => {
  try {
    const rawCookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookieHeader(rawCookieHeader);

    const deviceToken = cookies.deviceToken;
    const shiftToken = cookies.shiftToken;

    if (!deviceToken) {
      next(new Error("DEVICE_UNAUTHORIZED"));
      return;
    }
    jwt.verify(deviceToken, JWT_SECRET); // throws if forged/expired

    if (!shiftToken) {
      next(new Error("SHIFT_EXPIRED"));
      return;
    }
    const decodedShift = jwt.verify(
      shiftToken,
      JWT_SECRET,
    ) as unknown as AuthPayload;

    // Make the authenticated user available to event handlers later,
    // e.g. socket.on("connection", (socket) => { socket.data.user... })
    socket.data.user = decodedShift;

    next();
  } catch (error) {
    next(new Error("UNAUTHORIZED"));
  }
});

kitchenNamespace.on("connection", (socket) => {
  console.log(
    `Kitchen staff connected: ${socket.id} (user ${socket.data.user?.sub})`,
  );

  socket.on("disconnect", () => {
    console.log(`Kitchen staff disconnected: ${socket.id}`);
  });
});

// Default namespace — currently unused by any client, kept for future
// public-facing socket use (no auth, since it'd be customer-facing).
io.on("connection", (socket) => {
  console.log(`connected to websocket: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.message, err.stack);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: err.issues[0]?.message || "Invalid input",
      errors: err.issues,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Something went wrong, please try again later",
  });
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully`);
  httpServer.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C in local dev

// start server
httpServer.on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
httpServer.listen(PORT, () => console.log(`Server live on ${PORT}`));
