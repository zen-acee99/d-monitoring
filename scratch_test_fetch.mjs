import fetch from "node-forge";

async function checkApi() {
  const res = await (await import("http")).get("http://localhost:3001/api/dtr-generator");
  // Let's test with fetch
}
