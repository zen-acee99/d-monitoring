import { omadaService } from "./services/omadaService.js";

async function runSync() {
  console.log("Running omadaService.syncToDatabase()...");
  const res = await omadaService.syncToDatabase();
  console.log("Sync result:");
  console.log("Total Omada Sites:", res.totalOmadaSites);
  console.log("Updated in DB:", res.updatedRecords);
  console.log("New Created in DB:", res.newRecordsCreated);
  console.log("Supplier 1:", res.supplier1Count, "| Supplier 2:", res.supplier2Count);

  const overview = await omadaService.getOverview();
  console.log("\nOverview after sync:");
  console.log(JSON.stringify(overview, null, 2));
}

runSync().catch(console.error);
