import http from "node:http";
import net from "node:net";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export type NodeRole = "monitoring" | "dtr";
export type NodeTier = "api" | "client";

export interface UpstreamNode {
  id: string;
  name: string;
  role: NodeRole;
  tier: NodeTier;
  url: string;
  host: string;
  port: number;
  healthPath: string;
  healthy: boolean;
  status: "online" | "offline" | "degraded";
  latencyMs: number | null;
  lastChecked: string | null;
  lastError: string | null;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  failoverCount: number;
  details?: Record<string, any> | null;
}

export interface LoadBalancerConfig {
  port?: number;
  host?: string;
  monitoringClientUrl?: string;
  monitoringApiUrl?: string;
  dtrClientUrl?: string;
  dtrApiUrl?: string;
  healthCheckIntervalMs?: number;
  healthCheckTimeoutMs?: number;
  proxyTimeoutMs?: number;
  silent?: boolean;
}

export interface RoutingDecision {
  primary: UpstreamNode;
  backup: UpstreamNode | null;
  strategy: "round-robin" | "path-affinity" | "sticky-session" | "explicit-override" | "failover";
  setStickyCookie?: NodeRole;
  isAssetRequest?: boolean;
}

// Shared API prefixes that exist identically on both dict-monitoring (:3001) and dict-dtr-generator (:3003)
export const SHARED_API_PREFIXES = [
  "/api/dtr-generator",
  "/api/dtr-storage",
  "/api/dtr/storage",
  "/api/dtr-user-setup",
  "/api/dtr-schedule-settings",
  "/api/opentimeclock",
  "/api/users",
  "/api/auth",
  "/api/administration",
  "/api/health",
];

// API prefixes exclusive to dict-monitoring (:3001)
export const MONITORING_EXCLUSIVE_API_PREFIXES = [
  "/api/modules",
  "/api/omada",
  "/api/projects",
  "/api/overview",
];

// Frontend routes shared across both applications (Round-Robin load balanced)
export const SHARED_FRONTEND_PATHS = [
  "/dtr",
  "/signing-workspace",
];

// Frontend routes exclusive to dict-dtr-generator (:3002)
export const DTR_EXCLUSIVE_FRONTEND_PATHS = [
  "/schedule",
  "/user-setup",
  "/users",
];

// Frontend routes exclusive to dict-monitoring (:3000)
export const MONITORING_EXCLUSIVE_FRONTEND_PATHS = [
  "/calendar",
  "/projects",
  "/settings",
];

const ASSET_PATH_PREFIXES = [
  "/src/",
  "/@vite/",
  "/@react-refresh",
  "/@fs/",
  "/@id/",
  "/node_modules/",
  "/assets/",
];

const ASSET_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
  ".map",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".wasm",
];

function createNode(
  id: string,
  name: string,
  role: NodeRole,
  tier: NodeTier,
  rawUrl: string,
  healthPath: string
): UpstreamNode {
  const parsed = new URL(rawUrl);
  const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;
  return {
    id,
    name,
    role,
    tier,
    url: rawUrl.replace(/\/$/, ""),
    host: parsed.hostname || "127.0.0.1",
    port,
    healthPath,
    healthy: true, // Optimistically healthy until first health check completes
    status: "online",
    latencyMs: null,
    lastChecked: null,
    lastError: null,
    activeConnections: 0,
    totalRequests: 0,
    failedRequests: 0,
    failoverCount: 0,
    details: null,
  };
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function isAssetPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (ASSET_PATH_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isSharedApiPath(pathname: string): boolean {
  return SHARED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function matchesPathPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function inferRoleFromReferer(referer?: string): NodeRole | null {
  if (!referer) return null;
  try {
    const refUrl = new URL(referer);
    const lbNodeParam = refUrl.searchParams.get("lb_node");
    if (lbNodeParam === "monitoring" || lbNodeParam === "dtr") {
      return lbNodeParam;
    }
    if (matchesPathPrefix(refUrl.pathname, DTR_EXCLUSIVE_FRONTEND_PATHS)) {
      return "dtr";
    }
    if (matchesPathPrefix(refUrl.pathname, MONITORING_EXCLUSIVE_FRONTEND_PATHS)) {
      return "monitoring";
    }
  } catch {
    // Ignore malformed referer
  }
  return null;
}

export function createLoadBalancer(config: LoadBalancerConfig = {}) {
  const port = config.port ?? (process.env.LB_PORT ? parseInt(process.env.LB_PORT, 10) : 8080);
  const host = config.host ?? (process.env.LB_HOST || "0.0.0.0");
  const healthCheckIntervalMs =
    config.healthCheckIntervalMs ??
    (process.env.LB_HEALTH_INTERVAL ? parseInt(process.env.LB_HEALTH_INTERVAL, 10) : 5000);
  const healthCheckTimeoutMs =
    config.healthCheckTimeoutMs ??
    (process.env.LB_HEALTH_TIMEOUT ? parseInt(process.env.LB_HEALTH_TIMEOUT, 10) : 3000);
  const proxyTimeoutMs =
    config.proxyTimeoutMs ??
    (process.env.LB_PROXY_TIMEOUT ? parseInt(process.env.LB_PROXY_TIMEOUT, 10) : 60000);
  const silent = Boolean(config.silent);

  const monitoringClientUrl =
    config.monitoringClientUrl || process.env.MONITORING_CLIENT_URL || "http://127.0.0.1:3000";
  const monitoringApiUrl =
    config.monitoringApiUrl || process.env.MONITORING_API_URL || "http://127.0.0.1:3001";
  const dtrClientUrl =
    config.dtrClientUrl || process.env.DTR_CLIENT_URL || "http://127.0.0.1:3002";
  const dtrApiUrl =
    config.dtrApiUrl || process.env.DTR_API_URL || "http://127.0.0.1:3003";

  const nodes: Record<string, UpstreamNode> = {
    monitoringApi: createNode(
      "monitoring-api",
      "DICT Monitoring API Server",
      "monitoring",
      "api",
      monitoringApiUrl,
      "/api/health"
    ),
    dtrApi: createNode(
      "dtr-api",
      "DICT DTR Generator API Server",
      "dtr",
      "api",
      dtrApiUrl,
      "/api/health"
    ),
    monitoringClient: createNode(
      "monitoring-client",
      "DICT Monitoring Vite Client",
      "monitoring",
      "client",
      monitoringClientUrl,
      "/"
    ),
    dtrClient: createNode(
      "dtr-client",
      "DICT DTR Generator Vite Client",
      "dtr",
      "client",
      dtrClientUrl,
      "/"
    ),
  };

  const apiPool: UpstreamNode[] = [nodes.monitoringApi, nodes.dtrApi];
  const clientPool: UpstreamNode[] = [nodes.monitoringClient, nodes.dtrClient];

  let apiRoundRobinIndex = 0;
  let clientRoundRobinIndex = 0;
  let totalRequestsHandled = 0;
  const startedAt = new Date();
  let healthTimer: NodeJS.Timeout | null = null;

  function log(msg: string) {
    if (!silent) {
      console.log(`[LB ${new Date().toISOString()}] ${msg}`);
    }
  }

  async function checkSingleNodeHealth(node: UpstreamNode): Promise<boolean> {
    const start = Date.now();
    return new Promise<boolean>((resolve) => {
      const req = http.request(
        {
          hostname: node.host,
          port: node.port,
          path: node.healthPath,
          method: "GET",
          timeout: healthCheckTimeoutMs,
          headers: {
            Accept: "application/json, text/html, */*",
            "User-Agent": "DICT-LoadBalancer-HealthCheck/1.0",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            const latency = Date.now() - start;
            const statusCode = res.statusCode || 500;
            const wasHealthy = node.healthy;
            const isHealthy = statusCode >= 200 && statusCode < 500;

            node.healthy = isHealthy;
            node.status = isHealthy ? "online" : "degraded";
            node.latencyMs = latency;
            node.lastChecked = new Date().toISOString();
            node.lastError = isHealthy ? null : `HTTP ${statusCode}`;

            if (node.tier === "api") {
              try {
                const bodyText = Buffer.concat(chunks).toString("utf8");
                const parsed = JSON.parse(bodyText);
                node.details = {
                  status: parsed.status,
                  database: parsed.database,
                  connected: parsed.connected,
                };
              } catch {
                node.details = null;
              }
            }

            if (!wasHealthy && isHealthy) {
              log(`Node RECOVERED -> ${node.id} (${node.url}) [${latency}ms]`);
            } else if (wasHealthy && !isHealthy) {
              log(`Node DEGRADED -> ${node.id} (${node.url}) HTTP ${statusCode}`);
            }

            resolve(isHealthy);
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error(`Health check timeout after ${healthCheckTimeoutMs}ms`));
      });

      req.on("error", (err) => {
        const wasHealthy = node.healthy;
        node.healthy = false;
        node.status = "offline";
        node.latencyMs = null;
        node.lastChecked = new Date().toISOString();
        node.lastError = err.message || "Connection refused";
        node.details = null;

        if (wasHealthy) {
          log(`Node OFFLINE -> ${node.id} (${node.url}): ${node.lastError}`);
        }
        resolve(false);
      });

      req.end();
    });
  }

  async function runHealthChecks(): Promise<Record<string, UpstreamNode>> {
    await Promise.all(Object.values(nodes).map((n) => checkSingleNodeHealth(n)));
    return nodes;
  }

  function pickRoundRobin(pool: UpstreamNode[], isApi: boolean): { primary: UpstreamNode; backup: UpstreamNode | null; strategy: RoutingDecision["strategy"] } {
    const healthyNodes = pool.filter((n) => n.healthy);
    if (healthyNodes.length >= 2) {
      const idx = isApi ? apiRoundRobinIndex++ : clientRoundRobinIndex++;
      const primary = healthyNodes[idx % healthyNodes.length];
      const backup = healthyNodes[(idx + 1) % healthyNodes.length] || null;
      return { primary, backup, strategy: "round-robin" };
    }
    if (healthyNodes.length === 1) {
      const primary = healthyNodes[0];
      const backup = pool.find((n) => n.id !== primary.id) || null;
      primary.failoverCount += 1;
      return { primary, backup, strategy: "failover" };
    }
    // If both are marked unhealthy, still attempt round-robin so recovery can happen immediately
    const idx = isApi ? apiRoundRobinIndex++ : clientRoundRobinIndex++;
    const primary = pool[idx % pool.length];
    const backup = pool[(idx + 1) % pool.length] || null;
    return { primary, backup, strategy: "round-robin" };
  }

  function pickPreferredRole(
    pool: UpstreamNode[],
    preferredRole: NodeRole,
    strategyIfHealthy: RoutingDecision["strategy"]
  ): { primary: UpstreamNode; backup: UpstreamNode | null; strategy: RoutingDecision["strategy"] } {
    const preferred = pool.find((n) => n.role === preferredRole)!;
    const alternate = pool.find((n) => n.role !== preferredRole) || null;

    if (preferred.healthy) {
      return { primary: preferred, backup: alternate, strategy: strategyIfHealthy };
    }
    if (alternate && alternate.healthy) {
      alternate.failoverCount += 1;
      return { primary: alternate, backup: preferred, strategy: "failover" };
    }
    return { primary: preferred, backup: alternate, strategy: strategyIfHealthy };
  }

  function resolveRoute(req: http.IncomingMessage): RoutingDecision {
    const rawUrl = req.url || "/";
    const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;
    const cookies = parseCookies(req.headers.cookie);

    const explicitOverride =
      (parsedUrl.searchParams.get("lb_node") as NodeRole | null) ||
      (req.headers["x-lb-node"] as NodeRole | undefined);

    // 1. Backend API Routing (/api/*)
    if (pathname.startsWith("/api/") || pathname === "/api") {
      if (explicitOverride === "monitoring" || explicitOverride === "dtr") {
        const picked = pickPreferredRole(apiPool, explicitOverride, "explicit-override");
        return { ...picked };
      }

      if (isSharedApiPath(pathname)) {
        const picked = pickRoundRobin(apiPool, true);
        return { ...picked };
      }

      // Monitoring-exclusive API endpoints (/api/modules, /api/omada, /api/projects, etc.)
      const picked = pickPreferredRole(apiPool, "monitoring", "path-affinity");
      return { ...picked };
    }

    // 2. Frontend Client Routing (Vite SPA & Assets)
    if (explicitOverride === "monitoring" || explicitOverride === "dtr") {
      const picked = pickPreferredRole(clientPool, explicitOverride, "explicit-override");
      return {
        ...picked,
        setStickyCookie: picked.primary.role,
        isAssetRequest: false,
      };
    }

    // Check if this is a static/Vite module asset request (/src/*, /@vite/*, .js, .tsx, .css, etc.)
    if (isAssetPath(pathname)) {
      const cookieRole = cookies["dict_lb_node"] as NodeRole | undefined;
      const refererRole = inferRoleFromReferer(req.headers.referer);
      const targetRole: NodeRole =
        cookieRole === "monitoring" || cookieRole === "dtr"
          ? cookieRole
          : refererRole || "monitoring";

      const picked = pickPreferredRole(clientPool, targetRole, "sticky-session");
      return {
        ...picked,
        isAssetRequest: true,
      };
    }

    // DTR-exclusive SPA routes (/schedule, /user-setup, /users)
    if (matchesPathPrefix(pathname, DTR_EXCLUSIVE_FRONTEND_PATHS)) {
      const picked = pickPreferredRole(clientPool, "dtr", "path-affinity");
      return {
        ...picked,
        setStickyCookie: picked.primary.role,
        isAssetRequest: false,
      };
    }

    // Monitoring-exclusive SPA routes (/calendar, /projects/*, /settings/*)
    if (matchesPathPrefix(pathname, MONITORING_EXCLUSIVE_FRONTEND_PATHS)) {
      const picked = pickPreferredRole(clientPool, "monitoring", "path-affinity");
      return {
        ...picked,
        setStickyCookie: picked.primary.role,
        isAssetRequest: false,
      };
    }

    // Shared Frontend Workspaces (/dtr, /signing-workspace) -> Round-Robin across both frontends!
    if (matchesPathPrefix(pathname, SHARED_FRONTEND_PATHS)) {
      const picked = pickRoundRobin(clientPool, false);
      return {
        ...picked,
        setStickyCookie: picked.primary.role,
        isAssetRequest: false,
      };
    }

    // /login route -> preserve sticky session if present, else monitoring primary
    if (pathname === "/login") {
      const cookieRole = cookies["dict_lb_node"] as NodeRole | undefined;
      const role: NodeRole = cookieRole === "dtr" ? "dtr" : "monitoring";
      const picked = pickPreferredRole(clientPool, role, cookieRole ? "sticky-session" : "path-affinity");
      return {
        ...picked,
        setStickyCookie: picked.primary.role,
        isAssetRequest: false,
      };
    }

    // Default / Root (/) -> Monitoring Dashboard primary, DTR failover
    const picked = pickPreferredRole(clientPool, "monitoring", "path-affinity");
    return {
      ...picked,
      setStickyCookie: picked.primary.role,
      isAssetRequest: false,
    };
  }

  function getStatusPayload() {
    const allNodes = Object.values(nodes);
    const healthyApiCount = apiPool.filter((n) => n.healthy).length;
    const healthyClientCount = clientPool.filter((n) => n.healthy).length;
    const apiTotal = apiPool.reduce((acc, n) => acc + n.totalRequests, 0);
    const clientTotal = clientPool.reduce((acc, n) => acc + n.totalRequests, 0);

    return {
      status: healthyApiCount > 0 || healthyClientCount > 0 ? "online" : "degraded",
      loadBalancer: "DICT Built-in Node.js Application Load Balancer",
      version: "1.0.0",
      port,
      host,
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
      totalRequestsHandled,
      summary: {
        healthyApiNodes: `${healthyApiCount}/${apiPool.length}`,
        healthyClientNodes: `${healthyClientCount}/${clientPool.length}`,
        apiRequestsHandled: apiTotal,
        clientRequestsHandled: clientTotal,
      },
      nodes: {
        monitoringClient: nodes.monitoringClient,
        monitoringApi: nodes.monitoringApi,
        dtrClient: nodes.dtrClient,
        dtrApi: nodes.dtrApi,
      },
      routingRules: {
        sharedApiRoundRobin: SHARED_API_PREFIXES,
        monitoringExclusiveApi: MONITORING_EXCLUSIVE_API_PREFIXES,
        sharedFrontendRoundRobin: SHARED_FRONTEND_PATHS,
        dtrExclusiveFrontend: DTR_EXCLUSIVE_FRONTEND_PATHS,
        monitoringExclusiveFrontend: MONITORING_EXCLUSIVE_FRONTEND_PATHS,
      },
      allNodes,
    };
  }

  function renderStatusDashboardHtml(): string {
    const status = getStatusPayload();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DICT Load Balancer — Live Cluster Status</title>
  <style>
    :root {
      color-scheme: dark;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, monospace;
      background: #070B14;
      color: #E2E8F0;
      padding: 28px;
      line-height: 1.5;
    }
    .container { max-width: 1120px; margin: 0 auto; }
    .header {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      gap: 16px; padding-bottom: 20px; border-bottom: 1px solid #1E293B; margin-bottom: 24px;
    }
    .title { font-size: 22px; font-weight: 800; color: #F8FAFC; display: flex; align-items: center; gap: 10px; }
    .badge {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      padding: 4px 10px; border-radius: 999px;
    }
    .badge-online { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.35); }
    .badge-offline { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.35); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card {
      background: #0F172A; border: 1px solid #1E293B; border-radius: 14px; padding: 18px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .node-title { font-size: 14px; font-weight: 700; color: #F1F5F9; }
    .node-url { font-size: 12px; color: #64748B; font-family: monospace; margin-top: 2px; }
    .metric-row { display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0; border-top: 1px solid #1E293B/60; }
    .metric-label { color: #94A3B8; }
    .metric-val { font-weight: 700; font-family: monospace; color: #E2E8F0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;
      font-size: 12px; font-weight: 600; text-decoration: none; cursor: pointer;
      background: #1E293B; color: #E2E8F0; border: 1px solid #334155; transition: 0.15s;
    }
    .btn:hover { background: #334155; color: #FFFFFF; }
    .btn-primary { background: #2563EB; border-color: #3B82F6; color: #FFFFFF; }
    .btn-primary:hover { background: #1D4ED8; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 12px; }
    pre { background: #0B1120; border: 1px solid #1E293B; border-radius: 10px; padding: 14px; overflow-x: auto; font-size: 12px; color: #93C5FD; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">
          ⚡ DICT Node.js Load Balancer
          <span id="lb-status-badge" class="badge badge-online">${status.status.toUpperCase()}</span>
        </div>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 4px;">
          Gateway Port: <strong>:${status.port}</strong> • Total Requests: <strong id="total-reqs">${status.totalRequestsHandled}</strong> • Uptime: <strong id="uptime">${status.uptimeSeconds}s</strong>
        </p>
      </div>
      <div class="actions" style="margin-bottom: 0;">
        <a class="btn btn-primary" href="/?lb_node=monitoring">Open Monitoring (:3000)</a>
        <a class="btn btn-primary" href="/dtr?lb_node=dtr">Open DTR System (:3002)</a>
        <a class="btn" href="/dtr">Round-Robin /dtr</a>
        <a class="btn" href="/signing-workspace">Round-Robin /signing-workspace</a>
        <a class="btn" href="/lb-status?format=json">Raw JSON</a>
      </div>
    </div>

    <div class="section-title">Upstream Cluster Nodes</div>
    <div class="grid" id="nodes-grid"></div>

    <div class="section-title">Routing & Failover Configuration</div>
    <pre id="routing-json">${JSON.stringify(status.routingRules, null, 2)}</pre>
  </div>

  <script>
    function renderNodes(data) {
      document.getElementById('total-reqs').textContent = data.totalRequestsHandled;
      document.getElementById('uptime').textContent = data.uptimeSeconds + 's';
      const grid = document.getElementById('nodes-grid');
      grid.innerHTML = data.allNodes.map(node => {
        const badgeClass = node.healthy ? 'badge-online' : 'badge-offline';
        const statusText = node.healthy ? 'ONLINE' : 'OFFLINE';
        return \`
          <div class="card">
            <div class="card-header">
              <div>
                <div class="node-title">\${node.name}</div>
                <div class="node-url">\${node.url} (\${node.id})</div>
              </div>
              <span class="badge \${badgeClass}">\${statusText}</span>
            </div>
            <div class="metric-row"><span class="metric-label">Tier / Role</span><span class="metric-val">\${node.tier.toUpperCase()} / \${node.role}</span></div>
            <div class="metric-row"><span class="metric-label">Latency</span><span class="metric-val">\${node.latencyMs !== null ? node.latencyMs + ' ms' : '—'}</span></div>
            <div class="metric-row"><span class="metric-label">Requests Handled</span><span class="metric-val">\${node.totalRequests}</span></div>
            <div class="metric-row"><span class="metric-label">Active Conns</span><span class="metric-val">\${node.activeConnections}</span></div>
            <div class="metric-row"><span class="metric-label">Failovers / Errors</span><span class="metric-val">\${node.failoverCount} / \${node.failedRequests}</span></div>
            <div class="metric-row"><span class="metric-label">Last Checked</span><span class="metric-val">\${node.lastChecked ? new Date(node.lastChecked).toLocaleTimeString() : '—'}</span></div>
          </div>
        \`;
      }).join('');
    }

    renderNodes(${JSON.stringify(status)});
    setInterval(async () => {
      try {
        const res = await fetch('/api/lb/status');
        if (res.ok) {
          const data = await res.json();
          renderNodes(data);
        }
      } catch {}
    }, 3000);
  </script>
</body>
</html>`;
  }

  function bufferRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function proxyToNode(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    bodyBuffer: Buffer,
    target: UpstreamNode,
    backup: UpstreamNode | null,
    decision: RoutingDecision,
    isFallbackAttempt: boolean
  ) {
    target.activeConnections += 1;
    target.totalRequests += 1;

    const outgoingHeaders: http.OutgoingHttpHeaders = {
      ...req.headers,
      host: `${target.host}:${target.port}`,
      "x-forwarded-host": req.headers.host || `localhost:${port}`,
      "x-forwarded-proto": "http",
      "x-forwarded-for": req.socket.remoteAddress || "127.0.0.1",
      "x-lb-node": target.role,
    };

    if (bodyBuffer.length > 0) {
      outgoingHeaders["content-length"] = Buffer.byteLength(bodyBuffer);
    }

    const proxyReq = http.request(
      {
        hostname: target.host,
        port: target.port,
        path: req.url || "/",
        method: req.method || "GET",
        headers: outgoingHeaders,
        timeout: proxyTimeoutMs,
      },
      (proxyRes) => {
        target.activeConnections = Math.max(0, target.activeConnections - 1);

        // If this is a frontend asset request (.tsx, .ts, /src/*) that returned 404 on the primary node,
        // and we have a backup frontend node available, transparently try the backup node!
        if (
          !isFallbackAttempt &&
          decision.isAssetRequest &&
          proxyRes.statusCode === 404 &&
          backup &&
          (req.method === "GET" || req.method === "HEAD")
        ) {
          proxyRes.resume(); // Drain response stream
          backup.failoverCount += 1;
          proxyToNode(req, res, bodyBuffer, backup, null, { ...decision, strategy: "failover" }, true);
          return;
        }

        const responseHeaders: http.OutgoingHttpHeaders = {
          ...proxyRes.headers,
          "x-load-balancer": "DICT-Node-LB/1.0",
          "x-served-by": `${target.id} (${target.url})`,
          "x-lb-node": target.role,
          "x-lb-strategy": isFallbackAttempt ? "failover" : decision.strategy,
        };

        if (decision.setStickyCookie) {
          const existingSetCookie = proxyRes.headers["set-cookie"] || [];
          const cookieList = Array.isArray(existingSetCookie)
            ? [...existingSetCookie]
            : [existingSetCookie];
          cookieList.push(`dict_lb_node=${decision.setStickyCookie}; Path=/; SameSite=Lax`);
          responseHeaders["set-cookie"] = cookieList;
        }

        res.writeHead(proxyRes.statusCode || 200, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on("timeout", () => {
      proxyReq.destroy(new Error(`Upstream timeout after ${proxyTimeoutMs}ms`));
    });

    proxyReq.on("error", (err) => {
      target.activeConnections = Math.max(0, target.activeConnections - 1);
      target.failedRequests += 1;
      target.healthy = false;
      target.status = "offline";
      target.lastError = err.message;
      target.lastChecked = new Date().toISOString();

      log(`Upstream error on ${target.id} (${req.method} ${req.url}): ${err.message}`);

      // Automatic active failover to backup node if headers haven't been sent yet
      if (!isFallbackAttempt && backup && !res.headersSent) {
        log(`Failing over ${req.method} ${req.url} -> ${backup.id} (${backup.url})`);
        backup.failoverCount += 1;
        proxyToNode(req, res, bodyBuffer, backup, null, { ...decision, strategy: "failover" }, true);
        return;
      }

      if (!res.headersSent) {
        res.writeHead(502, {
          "Content-Type": "application/json",
          "x-load-balancer": "DICT-Node-LB/1.0",
        });
        res.end(
          JSON.stringify({
            status: "error",
            error: "Bad Gateway — All upstream servers for this route are currently unreachable.",
            attemptedNode: target.id,
            detail: err.message,
            lbStatusUrl: "/lb-status",
          })
        );
      } else {
        res.end();
      }
    });

    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  }

  const server = http.createServer(async (req, res) => {
    totalRequestsHandled += 1;
    const rawUrl = req.url || "/";
    const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    // Built-in Load Balancer Health Endpoint
    if (pathname === "/lb-health") {
      const payload = getStatusPayload();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-load-balancer": "DICT-Node-LB/1.0",
      });
      res.end(
        JSON.stringify({
          status: payload.status,
          healthyApiNodes: payload.summary.healthyApiNodes,
          healthyClientNodes: payload.summary.healthyClientNodes,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // Force immediate health check via POST /api/lb/health-check
    if (pathname === "/api/lb/health-check" && req.method === "POST") {
      await runHealthChecks();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-load-balancer": "DICT-Node-LB/1.0",
      });
      res.end(JSON.stringify(getStatusPayload(), null, 2));
      return;
    }

    // Built-in Load Balancer Status & Dashboard (/lb-status and /api/lb/status)
    if (pathname === "/lb-status" || pathname === "/api/lb/status") {
      const formatParam = parsedUrl.searchParams.get("format");
      const acceptHeader = req.headers.accept || "";
      const wantsHtml =
        pathname === "/lb-status" &&
        formatParam !== "json" &&
        acceptHeader.includes("text/html");

      if (wantsHtml) {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "x-load-balancer": "DICT-Node-LB/1.0",
        });
        res.end(renderStatusDashboardHtml());
      } else {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "x-load-balancer": "DICT-Node-LB/1.0",
        });
        res.end(JSON.stringify(getStatusPayload(), null, 2));
      }
      return;
    }

    try {
      const bodyBuffer = await bufferRequestBody(req);
      const decision = resolveRoute(req);
      proxyToNode(req, res, bodyBuffer, decision.primary, decision.backup, decision, false);
    } catch (err: any) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", error: err.message || "Internal LB Error" }));
      }
    }
  });

  // WebSocket / Vite HMR Upgrade Proxy
  server.on("upgrade", (req, clientSocket, head) => {
    const cookies = parseCookies(req.headers.cookie);
    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const explicitRole = parsedUrl.searchParams.get("lb_node") as NodeRole | null;
    const cookieRole = cookies["dict_lb_node"] as NodeRole | undefined;
    const preferredRole: NodeRole =
      explicitRole === "dtr" || explicitRole === "monitoring"
        ? explicitRole
        : cookieRole === "dtr"
        ? "dtr"
        : "monitoring";

    const { primary, backup } = pickPreferredRole(clientPool, preferredRole, "sticky-session");

    function connectWsUpstream(target: UpstreamNode, fallback: UpstreamNode | null) {
      const upstreamSocket = net.connect(target.port, target.host, () => {
        const reqLines: string[] = [`${req.method || "GET"} ${req.url || "/"} HTTP/${req.httpVersion}`];
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          const key = req.rawHeaders[i];
          const val = req.rawHeaders[i + 1];
          if (key.toLowerCase() === "host") {
            reqLines.push(`Host: ${target.host}:${target.port}`);
          } else {
            reqLines.push(`${key}: ${val}`);
          }
        }
        reqLines.push("", "");
        upstreamSocket.write(reqLines.join("\r\n"));
        if (head && head.length > 0) {
          upstreamSocket.write(head);
        }
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      });

      upstreamSocket.on("error", () => {
        upstreamSocket.destroy();
        if (fallback) {
          connectWsUpstream(fallback, null);
        } else {
          clientSocket.destroy();
        }
      });

      clientSocket.on("error", () => {
        upstreamSocket.destroy();
      });
    }

    connectWsUpstream(primary, backup);
  });

  async function start(): Promise<http.Server> {
    await runHealthChecks();
    if (healthCheckIntervalMs > 0) {
      healthTimer = setInterval(() => {
        runHealthChecks().catch(() => {});
      }, healthCheckIntervalMs);
      if (healthTimer.unref) {
        healthTimer.unref();
      }
    }

    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        if (!silent) {
          console.log(`================================================================`);
          console.log(` ⚡ DICT Built-in Load Balancer is running!`);
          console.log(` 🌐 Gateway URL:       http://localhost:${port}`);
          console.log(` 📊 Live Status UI:    http://localhost:${port}/lb-status`);
          console.log(` 🩺 Health Endpoint:   http://localhost:${port}/lb-health`);
          console.log(`----------------------------------------------------------------`);
          console.log(` 🖥️  Monitoring Client: ${nodes.monitoringClient.url} [${nodes.monitoringClient.status.toUpperCase()}]`);
          console.log(` ⚙️  Monitoring API:    ${nodes.monitoringApi.url} [${nodes.monitoringApi.status.toUpperCase()}]`);
          console.log(` 🖥️  DTR Client:        ${nodes.dtrClient.url} [${nodes.dtrClient.status.toUpperCase()}]`);
          console.log(` ⚙️  DTR API:           ${nodes.dtrApi.url} [${nodes.dtrApi.status.toUpperCase()}]`);
          console.log(`================================================================`);
        }
        resolve(server);
      });
    });
  }

  async function stop(): Promise<void> {
    if (healthTimer) {
      clearInterval(healthTimer);
      healthTimer = null;
    }
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  return {
    server,
    nodes,
    start,
    stop,
    runHealthChecks,
    resolveRoute,
    getStatusPayload,
  };
}

// Auto-start if executed directly via `tsx server/load-balancer.ts`
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const lb = createLoadBalancer();
  lb.start().catch((err: any) => {
    if (err && err.code === "EADDRINUSE") {
      console.log(`[LB] ⚡ Load Balancer gateway is already running on port ${process.env.LB_PORT || 8080} — attached to active gateway.`);
      setInterval(() => {}, 60000);
      return;
    }
    console.error("Failed to start DICT Load Balancer:", err);
    process.exit(1);
  });
}
