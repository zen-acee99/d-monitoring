import http from "node:http";
import net from "node:net";
import assert from "node:assert/strict";
import { createLoadBalancer } from "../server/load-balancer.js";

function startMockServer(
  name: string,
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void
): Promise<{ server: http.Server; port: number; url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        handler(req, res, body);
      });
    });

    server.on("upgrade", (req, socket, head) => {
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `X-Mock-WS-Server: ${name}\r\n` +
          "\r\n"
      );
      if (head && head.length > 0) {
        socket.write(head);
      }
      socket.on("data", (data) => {
        socket.write(Buffer.from(`ECHO:${name}:${data.toString("utf8")}`));
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        server,
        port: addr.port,
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((resClose) => server.close(() => resClose())),
      });
    });
  });
}

async function runTests() {
  console.log("Starting mock upstream servers...");

  const monApi = await startMockServer("monitoring-api", (req, res, body) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        server: "monitoring-api",
        method: req.method,
        url: req.url,
        body: body ? JSON.parse(body) : null,
      })
    );
  });

  let dtrApiRef = await startMockServer("dtr-api", (req, res, body) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        server: "dtr-api",
        method: req.method,
        url: req.url,
        body: body ? JSON.parse(body) : null,
      })
    );
  });

  const monClient = await startMockServer("monitoring-client", (req, res) => {
    if (req.url === "/src/pages/ScheduleSettingsPage.tsx") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found on Monitoring Client");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body>monitoring-client:${req.url}</body></html>`);
  });

  const dtrClient = await startMockServer("dtr-client", (req, res) => {
    if (req.url === "/src/pages/Dashboard.tsx") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found on DTR Client");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body>dtr-client:${req.url}</body></html>`);
  });

  const lb = createLoadBalancer({
    port: 0, // Ephemeral port for test isolation
    host: "127.0.0.1",
    monitoringClientUrl: monClient.url,
    monitoringApiUrl: monApi.url,
    dtrClientUrl: dtrClient.url,
    dtrApiUrl: dtrApiRef.url,
    healthCheckIntervalMs: 0, // Manual trigger during test
    silent: true,
  });

  const lbServer = await lb.start();
  const lbPort = (lbServer.address() as net.AddressInfo).port;
  const lbBase = `http://127.0.0.1:${lbPort}`;

  try {
    // 1. Test /lb-health & /lb-status (JSON and HTML)
    console.log("1. Testing /lb-health and /lb-status...");
    const healthRes = await fetch(`${lbBase}/lb-health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, "online");
    assert.equal(healthData.healthyApiNodes, "2/2");
    assert.equal(healthData.healthyClientNodes, "2/2");

    const statusJsonRes = await fetch(`${lbBase}/lb-status`, {
      headers: { Accept: "application/json" },
    });
    assert.equal(statusJsonRes.status, 200);
    const statusJson = await statusJsonRes.json();
    assert.equal(statusJson.summary.healthyApiNodes, "2/2");

    const statusHtmlRes = await fetch(`${lbBase}/lb-status`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(statusHtmlRes.status, 200);
    const statusHtml = await statusHtmlRes.text();
    assert.ok(statusHtml.includes("DICT Node.js Load Balancer"));

    // 2. Test Shared API Round-Robin (/api/dtr-generator, /api/dtr-storage, /api/users, /api/administration)
    console.log("2. Testing Shared API Round-Robin...");
    const sharedApiServers: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${lbBase}/api/dtr-generator`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-lb-strategy"), "round-robin");
      const data = await r.json();
      sharedApiServers.push(data.server);
    }
    const monHits = sharedApiServers.filter((s) => s === "monitoring-api").length;
    const dtrHits = sharedApiServers.filter((s) => s === "dtr-api").length;
    assert.equal(monHits, 3, "Expected 3 hits to monitoring-api");
    assert.equal(dtrHits, 3, "Expected 3 hits to dtr-api");

    // 3. Test Monitoring-Exclusive API Path Affinity (/api/modules, /api/omada, /api/projects)
    console.log("3. Testing Monitoring-Exclusive API Path Affinity...");
    for (const apiPath of ["/api/modules", "/api/omada", "/api/projects", "/api/overview/stats"]) {
      const r = await fetch(`${lbBase}${apiPath}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-lb-node"), "monitoring");
      assert.equal(r.headers.get("x-lb-strategy"), "path-affinity");
      const data = await r.json();
      assert.equal(data.server, "monitoring-api");
    }

    // 4. Test Shared Frontend Paths Round-Robin (/dtr, /signing-workspace) & Sticky Cookie
    console.log("4. Testing Shared Frontend Paths Round-Robin (/dtr, /signing-workspace)...");
    const dtrPageNodes: string[] = [];
    for (let i = 0; i < 4; i++) {
      const p = i % 2 === 0 ? "/dtr" : "/signing-workspace";
      const r = await fetch(`${lbBase}${p}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-lb-strategy"), "round-robin");
      const setCookie = r.headers.get("set-cookie") || "";
      const nodeRole = r.headers.get("x-lb-node")!;
      assert.ok(setCookie.includes(`dict_lb_node=${nodeRole}`), "Expected sticky cookie to match chosen node");
      dtrPageNodes.push(nodeRole);
    }
    assert.equal(dtrPageNodes.filter((n) => n === "monitoring").length, 2);
    assert.equal(dtrPageNodes.filter((n) => n === "dtr").length, 2);

    // 5. Test Exclusive Frontend Paths (/schedule, /user-setup, /users vs /, /calendar, /projects/freewifi)
    console.log("5. Testing Exclusive Frontend Path Affinity...");
    for (const dtrPath of ["/schedule", "/user-setup", "/users"]) {
      const r = await fetch(`${lbBase}${dtrPath}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-lb-node"), "dtr");
      const text = await r.text();
      assert.ok(text.includes("dtr-client:"));
    }
    for (const monPath of ["/", "/calendar", "/projects/freewifi", "/settings/system"]) {
      const r = await fetch(`${lbBase}${monPath}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-lb-node"), "monitoring");
      const text = await r.text();
      assert.ok(text.includes("monitoring-client:"));
    }

    // 6. Test Sticky Asset Routing & 404 Cross-Node Asset Fallback
    console.log("6. Testing Sticky Asset Routing & 404 Cross-Node Asset Fallback...");
    const assetDtr = await fetch(`${lbBase}/src/main.tsx`, {
      headers: { Cookie: "dict_lb_node=dtr" },
    });
    assert.equal(assetDtr.headers.get("x-lb-node"), "dtr");
    assert.equal(assetDtr.headers.get("x-lb-strategy"), "sticky-session");

    const assetMon = await fetch(`${lbBase}/src/main.tsx`, {
      headers: { Cookie: "dict_lb_node=monitoring" },
    });
    assert.equal(assetMon.headers.get("x-lb-node"), "monitoring");
    assert.equal(assetMon.headers.get("x-lb-strategy"), "sticky-session");

    // Request /src/pages/ScheduleSettingsPage.tsx with monitoring cookie -> 404 on monitoringClient -> automatic fallback to dtrClient!
    const fallbackAsset = await fetch(`${lbBase}/src/pages/ScheduleSettingsPage.tsx`, {
      headers: { Cookie: "dict_lb_node=monitoring" },
    });
    assert.equal(fallbackAsset.status, 200);
    assert.equal(fallbackAsset.headers.get("x-lb-node"), "dtr");
    assert.equal(fallbackAsset.headers.get("x-lb-strategy"), "failover");

    // 7. Test Active Mid-Flight Failover (Stop dtr-api abruptly and send POST requests)
    console.log("7. Testing Active Mid-Flight Failover with POST body replay...");
    await dtrApiRef.close();

    for (let i = 0; i < 4; i++) {
      const postRes = await fetch(`${lbBase}/api/dtr-generator/sign-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: `doc-${i}`, signer: "Juan Dela Cruz" }),
      });
      assert.equal(postRes.status, 200);
      const data = await postRes.json();
      assert.equal(data.server, "monitoring-api");
      assert.equal(data.body.docId, `doc-${i}`);
      assert.equal(data.body.signer, "Juan Dela Cruz");
    }

    // 8. Test WebSocket Upgrade Proxying
    console.log("8. Testing WebSocket Upgrade Proxying (Vite HMR)...");
    const wsEcho = await new Promise<string>((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: lbPort,
        path: "/",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          Cookie: "dict_lb_node=dtr",
        },
      });
      req.on("upgrade", (res, socket) => {
        assert.equal(res.headers["x-mock-ws-server"], "dtr-client");
        socket.on("data", (chunk) => {
          const msg = chunk.toString("utf8");
          socket.destroy();
          resolve(msg);
        });
        socket.write("ping-hmr");
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(wsEcho, "ECHO:dtr-client:ping-hmr");

    // 9. Test 502 Bad Gateway when ALL API nodes are down
    console.log("9. Testing 502 Bad Gateway when all API nodes are offline...");
    await monApi.close();
    const downRes = await fetch(`${lbBase}/api/dtr-generator`);
    assert.equal(downRes.status, 502);
    const downBody = await downRes.json();
    assert.equal(downBody.status, "error");

    console.log("✅ ALL 9 LOAD BALANCER TEST SUITES PASSED!");
  } finally {
    await lb.stop();
    await monApi.close().catch(() => {});
    await dtrApiRef.close().catch(() => {});
    await monClient.close().catch(() => {});
    await dtrClient.close().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("❌ Load Balancer tests failed:", err);
  process.exit(1);
});
