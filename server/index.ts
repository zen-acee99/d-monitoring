import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, dbConfig, isRemoteTurso } from "./db.js";
import { initDatabase, PROJECT_TABLES } from "./schema.js";
import { projectsRouter } from "./routes/projects.js";
import { administrationRouter } from "./routes/administration.js";
import { dtrGeneratorRouter } from "./routes/dtrGenerator.js";
import { dtrStorageRouter } from "./routes/dtrStorage.js";
import { modulesRouter } from "./routes/modules.js";
import { usersRouter } from "./routes/users.js";
import { omadaRouter } from "./routes/omada.js";
import { omadaService } from "./services/omadaService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get("/api/health", async (_req, res) => {
  try {
    const test = await db.execute("SELECT 1 as healthy");
    const tableCounts: Record<string, number> = {};

    for (const tbl of PROJECT_TABLES) {
      try {
        const c = await db.execute(`SELECT COUNT(*) as count FROM "${tbl}"`);
        tableCounts[tbl] = Number(c.rows[0]?.count ?? 0);
      } catch {
        tableCounts[tbl] = -1;
      }
    }

    try {
      const adminCount = await db.execute("SELECT COUNT(*) as count FROM administration");
      tableCounts["administration"] = Number(adminCount.rows[0]?.count ?? 0);
    } catch {
      tableCounts["administration"] = 0;
    }

    try {
      const dtrCount = await db.execute("SELECT COUNT(*) as count FROM dtr_generator");
      tableCounts["dtr_generator"] = Number(dtrCount.rows[0]?.count ?? 0);
    } catch {
      tableCounts["dtr_generator"] = 0;
    }

    try {
      const modCount = await db.execute("SELECT COUNT(*) as count FROM module");
      tableCounts["module"] = Number(modCount.rows[0]?.count ?? 0);
    } catch {
      tableCounts["module"] = 0;
    }

    res.json({
      status: "ok",
      database: isRemoteTurso ? "Turso Cloud (libSQL)" : "Local SQLite / libSQL Fallback",
      dbUrl: dbConfig.url,
      connected: test.rows.length > 0,
      timestamp: new Date().toISOString(),
      projectTables: tableCounts,
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message,
      database: isRemoteTurso ? "Turso Cloud" : "Local SQLite",
    });
  }
});

// Mount routers on /api
app.use("/api/users", usersRouter);
app.use("/api/auth", usersRouter);
app.use("/api/administration", administrationRouter);
app.use("/api/dtr-generator", dtrGeneratorRouter);
app.use("/api/dtr-storage", dtrStorageRouter);
app.use("/api/dtr/storage", dtrStorageRouter);
app.use("/api/modules", modulesRouter);
app.use("/api/omada", omadaRouter);
app.use("/api", projectsRouter);

// Root fallback
app.get("/", (_req, res) => {
  res.json({
    message: "DICT Monitoring System Backend API",
    status: "running",
    docs: "/api/health",
    tables: PROJECT_TABLES,
  });
});

// Start server
async function startServer() {
  try {
    // Initialize tables and seed initial data
    await initDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`=========================================`);
      console.log(` DICT Monitoring Backend is running!`);
      console.log(` URL: http://localhost:${PORT}`);
      console.log(` Database: ${isRemoteTurso ? "Turso Cloud" : "Local SQLite (file:local.db)"}`);
      console.log(` Project Tables: ${PROJECT_TABLES.join(", ")}`);
      console.log(`=========================================`);

      // Initialize background Omada auto-sync worker
      omadaService.startAutoSyncScheduler().catch((err) => {
        console.warn("[Omada Service] Failed to initialize auto-sync scheduler:", err);
      });
    });
  } catch (error) {
    console.error("Failed to start backend server:", error);
    process.exit(1);
  }
}

startServer();
