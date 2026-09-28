import { omadaService } from "./services/omadaService.js";

async function auditOnlineOffline() {
  console.log("Auditing Online/Offline devices and sites across Supplier 1 and Supplier 2...");

  const config = await omadaService.getConfig();
  // Ensure supplier 2 is enabled in config
  await omadaService.saveConfig({
    supplier1: { ...config.supplier1, enabled: true },
    supplier2: { ...config.supplier2, enabled: true },
  });

  const sites1 = await omadaService.fetchSupplierSites("supplier1");
  const sites2 = await omadaService.fetchSupplierSites("supplier2");

  let s1Stats = { totalSites: sites1.length, onlineSites: 0, offlineSites: 0, partialSites: 0, totalDevs: 0, onlineDevs: 0, offlineDevs: 0 };
  let s2Stats = { totalSites: sites2.length, onlineSites: 0, offlineSites: 0, partialSites: 0, totalDevs: 0, onlineDevs: 0, offlineDevs: 0 };

  console.log(`Fetching devices for ${sites1.length} sites in Supplier 1 in parallel chunks...`);
  const chunkSize = 20;
  for (let i = 0; i < sites1.length; i += chunkSize) {
    const chunk = sites1.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (s) => {
        const devs = await omadaService.fetchSiteDevices("supplier1", s.siteId);
        s1Stats.totalDevs += devs.length;
        const online = devs.filter((d) => d.status === 1).length;
        const offline = devs.filter((d) => d.status === 0 || d.status !== 1).length;
        s1Stats.onlineDevs += online;
        s1Stats.offlineDevs += offline;

        if (devs.length === 0) {
          s1Stats.offlineSites++;
        } else if (online === devs.length) {
          s1Stats.onlineSites++;
        } else if (online === 0) {
          s1Stats.offlineSites++;
        } else {
          s1Stats.partialSites++;
        }
      })
    );
  }

  console.log(`Fetching devices for ${sites2.length} sites in Supplier 2 in parallel chunks...`);
  for (let i = 0; i < sites2.length; i += chunkSize) {
    const chunk = sites2.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (s) => {
        const devs = await omadaService.fetchSiteDevices("supplier2", s.siteId);
        s2Stats.totalDevs += devs.length;
        const online = devs.filter((d) => d.status === 1).length;
        const offline = devs.filter((d) => d.status === 0 || d.status !== 1).length;
        s2Stats.onlineDevs += online;
        s2Stats.offlineDevs += offline;

        if (devs.length === 0) {
          s2Stats.offlineSites++;
        } else if (online === devs.length) {
          s2Stats.onlineSites++;
        } else if (online === 0) {
          s2Stats.offlineSites++;
        } else {
          s2Stats.partialSites++;
        }
      })
    );
  }

  console.log("\n=================================================");
  console.log("  SUPPLIER 1 & SUPPLIER 2 ONLINE/OFFLINE METRICS ");
  console.log("=================================================");
  console.log("Supplier 1:");
  console.log(`  - Sites: ${s1Stats.totalSites} (Online: ${s1Stats.onlineSites}, Partial: ${s1Stats.partialSites}, Offline: ${s1Stats.offlineSites})`);
  console.log(`  - Devices: ${s1Stats.totalDevs} (Online: ${s1Stats.onlineDevs}, Offline: ${s1Stats.offlineDevs})`);
  console.log("Supplier 2:");
  console.log(`  - Sites: ${s2Stats.totalSites} (Online: ${s2Stats.onlineSites}, Partial: ${s2Stats.partialSites}, Offline: ${s2Stats.offlineSites})`);
  console.log(`  - Devices: ${s2Stats.totalDevs} (Online: ${s2Stats.onlineDevs}, Offline: ${s2Stats.offlineDevs})`);
  console.log("Total Combined:");
  console.log(`  - Total Sites: ${s1Stats.totalSites + s2Stats.totalSites}`);
  console.log(`  - Total Online Sites: ${s1Stats.onlineSites + s2Stats.onlineSites}`);
  console.log(`  - Total Partial Sites: ${s1Stats.partialSites + s2Stats.partialSites}`);
  console.log(`  - Total Offline Sites: ${s1Stats.offlineSites + s2Stats.offlineSites}`);
  console.log(`  - Total Devices: ${s1Stats.totalDevs + s2Stats.totalDevs}`);
  console.log(`  - Total Online Devices: ${s1Stats.onlineDevs + s2Stats.onlineDevs}`);
  console.log(`  - Total Offline Devices: ${s1Stats.offlineDevs + s2Stats.offlineDevs}`);
}

auditOnlineOffline().catch(console.error);
