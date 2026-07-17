import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";

import { registerHealthRoutes } from "./src/server/routes/healthRoutes";
import { registerAnalyzeRoutes } from "./src/server/routes/analyzeRoutes";
import { registerFusionRoutes } from "./src/server/routes/fusionRoutes";
import { registerHotspotRoutes } from "./src/server/routes/hotspotRoutes";

// Load environment variables
dotenv.config();

const DEMO_MODE = process.env.DEMO_MODE === "true" || process.env.VITE_DEMO_MODE === "true";
const PORT = 3000;

// Initialize Gemini SDK if API key is present
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });
  app.use(express.json({ limit: "25mb" })); // Support larger base64 images

  // Register modular route groups
  registerHealthRoutes(app, { DEMO_MODE });
  registerAnalyzeRoutes(app, { ai, DEMO_MODE });
  registerFusionRoutes(app, { DEMO_MODE });
  registerHotspotRoutes(app, { DEMO_MODE });

  // ==========================================
  // VITE OR STATIC FILE SERVING
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AEROGRID Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
