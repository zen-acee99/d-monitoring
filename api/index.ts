import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, dbConfig, isRemoteTurso } from "../server/db.js";
import { initDatabase, PROJECT_TABLES } from "../server/schema.js";
import { projectsRouter } from "../server/routes/projects.js";
import { administrationRouter } from "../server/routes/administration.js";
import { dtrGeneratorRouter } from "../server/routes/dtrGenerator.js";
import { dtrStorageRouter } from "../server/routes/dtrStorage.js";
import { dtrUserSetupRouter } from "../server/routes/dtrUserSetup.js";
import { dtrScheduleSettingsRouter } from "../server/routes/dtrScheduleSettings.js";
import { openTimeClockRouter } from "../server/routes/openTimeClock.js";
import { modulesRouter } from "../server/routes/modules.js";
import { usersRouter } from "../server/routes/users.js";
import { omadaRouter } from "../server/routes/omada.js";

dotenv.config();

const app = express();

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
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com; frame-ancestors 'self';"
  );
  next();
});

// CORS origin validation
function isAllowedCorsOrigin(origin?: string): boolean {
  if (!origin) return true;
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(trimmed)) {
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

function authRateLimiter(req: Request, res: Response, next: express.NextFunction) {
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

// Lazy DB init promise for serverless environment
let dbInitPromise: Promise<void> | null = null;
function ensureDbInit() {
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().catch((e) => {
      console.warn("DB init warning in serverless environment:", e);
    });
  }
  return dbInitPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDbInit();
  } catch {}
  next();
});

// Health check endpoint (sanitized — never exposes raw dbUrl)
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

export default app;
