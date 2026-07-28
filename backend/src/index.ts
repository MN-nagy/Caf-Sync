import express from "express";
import cors from "cors";
import { db } from "./db/index.ts";
import { drinks } from "./db/schema.ts";

const app = express();
const PORT = 3001;

// middleware
app.use(cors()); // to allow Next.js "on port 3000" to talk to this server
app.use(express.json()); // Add JSON understanding to the server

// API endpoints

app.get("/api/menu", async (_, res) => {
  try {
    console.log("fetching from db..");
    const menu = await db.select().from(drinks);
    res.json(menu);
  } catch (error) {
    console.error("fetch faild", error);
    res.status(500).json({ error: "Faild to fetch menu" });
  }
});

// start server
app.listen(PORT, () => {
  console.log(`Connected To ${PORT}`);
});
