import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, dbConfig, isRemoteTurso } from "./db.js";
import { initDatabase, PROJECT_TABLES } from "./schema.js";
import { projectsRouter } from "./routes/projects.js";
import { administrationRouter } from "./routes/administration.js";
import { dtrGeneratorRouter } from "./routes/dtrGenerator.js";
import { dtrStorageRouter } from "./routes/dtrStorage.js";
import { dtrUserSetupRouter } from "./routes/dtrUserSetup.js";
import { dtrScheduleSettingsRouter } from "./routes/dtrScheduleSettings.js";
import { openTimeClockRouter } from "./routes/openTimeClock.js";
import { modulesRouter } from "./routes/modules.js";
import { usersRouter } from "./routes/users.js";
import { omadaRouter } from "./routes/omada.js";
import { omadaService } from "./services/omadaService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.disable("x-powered-by");

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self';"
  );
  next();
});

// CORS origin validation
function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) return true;
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(trimmed)) {
    return true;
  }
  const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (extraOrigins.includes(trimmed) || extraOrigins.includes("*")) {
    return true;
  }
  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-id",
    "x-lb-node",
    "Cache-Control",
    "Pragma",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// In-memory rate limiter for authentication & cryptographic signing endpoints
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 25;

function authRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIp =
    (req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0].trim() : "") ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";
  const rawRoute = (req.baseUrl || req.path || req.originalUrl || "").split("?")[0].toLowerCase().replace(/\/+$/, "");
  const normalizedRoute = rawRoute === "/api/auth/login" ? "/api/users/login" : rawRoute;
  const key = `${clientIp}:${normalizedRoute}`;
  const now = Date.now();

  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
  }

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      success: false,
      error: "Too many authentication/signing attempts. Please wait a minute before trying again.",
    });
  }

  return next();
}

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

// Health check endpoint (sanitized — never exposes raw dbUrl)
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

// Apply rate limiter on sensitive authentication and PDF signing routes
app.use(
  ["/api/users/login", "/api/auth/login", "/api/administration/login", "/api/dtr-generator/sign-pdf"],
  authRateLimiter
);

// Mount routers on /api
app.use("/api/users", usersRouter);
app.use("/api/auth", usersRouter);
app.use("/api/administration", administrationRouter);
app.use("/api/dtr-generator", dtrGeneratorRouter);
app.use("/api/dtr-user-setup", dtrUserSetupRouter);
app.use("/api/dtr-schedule-settings", dtrScheduleSettingsRouter);
app.use("/api/opentimeclock", openTimeClockRouter);
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
