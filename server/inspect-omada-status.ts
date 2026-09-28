import { omadaService } from "./services/omadaService.js";

async function inspectOmadaData() {
  const config = await omadaService.getConfig();

  // Test Supplier 1
  const token1 = await omadaService.getAccessToken("supplier1");
  const baseUrl1 = config.supplier1.baseUrl.replace(/\/+$/, "");

  // 1. Fetch first 5 sites from Supplier 1
  const sitesRes1 = await fetch(
    `${baseUrl1}/openapi/v1/${config.supplier1.omadaId}/sites?page=1&pageSize=5`,
    {
      headers: { Authorization: `AccessToken=${token1}` },
    }
  );
  const sitesData1 = await sitesRes1.json();
  console.log("Supplier 1 Sample Site payload:");
  console.log(JSON.stringify(sitesData1.result?.data?.[0], null, 2));

  if (sitesData1.result?.data?.[0]?.siteId) {
    const siteId = sitesData1.result.data[0].siteId;
    const devRes = await fetch(
      `${baseUrl1}/openapi/v1/${config.supplier1.omadaId}/sites/${siteId}/devices?page=1&pageSize=10`,
      {
        headers: { Authorization: `AccessToken=${token1}` },
      }
    );
    const devData = await devRes.json();
    console.log(`\nSupplier 1 Sample Device payload for site ${siteId}:`);
    console.log(JSON.stringify(devData.result?.data?.[0], null, 2));
    console.log(
      "Device list statuses:",
      devData.result?.data?.map((d: any) => ({
        name: d.name,
        type: d.type,
        status: d.status,
        active: d.active,
        ip: d.ip,
      }))
    );
  }

  // Check multiple sites to see device statuses across Supplier 1
  const allSites1 = await omadaService.fetchSupplierSites("supplier1");
  console.log("\nChecking first 5 sites device statuses in Supplier 1:");
  for (let i = 0; i < Math.min(5, allSites1.length); i++) {
    const s = allSites1[i];
    const devs = await omadaService.fetchSiteDevices("supplier1", s.siteId);
    console.log(
      `Site: ${s.name} (${s.siteId}) -> Devices: ${devs.length} | Statuses:`,
      devs.map((d: any) => ({
        name: d.name,
        status: d.status,
        active: d.active,
        type: d.type,
      }))
    );
  }

  // Check Supplier 2 sample
  const token2 = await omadaService.getAccessToken("supplier2");
  const baseUrl2 = config.supplier2.baseUrl.replace(/\/+$/, "");
  const sitesRes2 = await fetch(
    `${baseUrl2}/openapi/v1/${config.supplier2.omadaId}/sites?page=1&pageSize=5`,
    {
      headers: { Authorization: `AccessToken=${token2}` },
    }
  );
  const sitesData2 = await sitesRes2.json();
  if (sitesData2.result?.data?.[0]?.siteId) {
    const sId = sitesData2.result.data[0].siteId;
    const devRes2 = await fetch(
      `${baseUrl2}/openapi/v1/${config.supplier2.omadaId}/sites/${sId}/devices?page=1&pageSize=10`,
      {
        headers: { Authorization: `AccessToken=${token2}` },
      }
    );
    const devData2 = await devRes2.json();
    console.log(`\nSupplier 2 Sample Device payload for site ${sId}:`);
    console.log(
      "Device list statuses:",
      devData2.result?.data?.map((d: any) => ({
        name: d.name,
        type: d.type,
        status: d.status,
        active: d.active,
        ip: d.ip,
      }))
    );
  }
}

inspectOmadaData().catch((e) => console.error(e));
