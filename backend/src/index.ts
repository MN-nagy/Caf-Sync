import type { Request, Response, NextFunction } from "express";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import menuRouter from "./routes/menu.route.ts";
import orderRouter from "./routes/order.route.ts";
import authRouter from "./routes/auth.route.ts";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// middleware
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
); // allowing client to talk to here
app.use(express.json()); // JSON

// API endpoints
app.use("/api/menu", menuRouter);
app.use("/api/orders", orderRouter);
app.use("/api/auth", authRouter);

// websocket
app.set("io", io); // making io accessable via req.app.get("io")

io.on("connection", (socket) => {
  console.log(`connected to websocket: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// start server
function startServer() {
  try {
    httpServer.listen(PORT, () => {
      console.log(`Server and Websocket live on ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to connect to ${PORT}`, error);
    process.exit(1);
  }
}

// error handeler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error", err.message, err.stack);
  res.status(500).json({
    status: "error",
    message: "Something went wrong, please try again later",
  });
});

startServer();
