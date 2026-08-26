import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatHandler from "./api/chat.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "10mb" }));

app.post("/api/chat", chatHandler);

app.use(express.static(__dirname));

app.get("/login", (req, res) => {
  res.sendFile(
    path.join(__dirname, "login.html")
  );
});

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

export default app;
