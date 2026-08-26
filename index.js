import app from "./api/index.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

export default app;
