import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, dbConfig, isRemoteTurso } from "../server/db.js";
import { initDatabase, PROJECT_TABLES } from "../server/schema.js";
import { projectsRouter } from "../server/routes/projects.js";
import { administrationRouter } from "../server/routes/administration.js";
import { dtrGeneratorRouter } from "../server/routes/dtrGenerator.js";
import { dtrStorageRouter } from "../server/routes/dtrStorage.js";
import { modulesRouter } from "../server/routes/modules.js";
import { usersRouter } from "../server/routes/users.js";
import { omadaRouter } from "../server/routes/omada.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy DB init flag for serverless environment
let dbInitialized = false;
app.use(async (_req, _res, next) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (e) {
      console.warn("DB init warning in serverless environment:", e);
    }
  }
  next();
});

// Health check endpoint
app.get("/api/health", async (_req: Request, res: Response) => {
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

export default app;
