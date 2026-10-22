import "dotenv/config";
import express from "express";
import path from "node:path";
import { apiRouter } from "./api.js";
import { mcpRouter } from "../mcp/index.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

// Serve the dashboard files from the project's public directory.
app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiRouter);
app.use("/mcp", mcpRouter);

app.listen(port, "127.0.0.1", () => {
  console.log(`Doorbell Without Ears server running at http://127.0.0.1:${port}`);
  console.log("Dashboard: http://127.0.0.1:3000");
  console.log("MCP endpoint: http://127.0.0.1:3000/mcp");
  console.log("Visitor events are simulated; no live Ring connection is configured.");
});
