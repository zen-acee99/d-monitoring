import { Router } from "express";
import { omadaService, OmadaSupplierConfig } from "../services/omadaService.js";

export const omadaRouter = Router();

// 1. Get current Omada configuration (Supplier 1 and Supplier 2)
omadaRouter.get("/config", async (_req, res) => {
  try {
    const config = await omadaService.getConfig();
    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch Omada configuration",
    });
  }
});

// 2. Update Omada configuration
omadaRouter.put("/config", async (req, res) => {
  try {
    const updates = req.body;
    const updated = await omadaService.saveConfig(updates);
    res.json({
      success: true,
      message: "Omada Northbound configuration saved successfully.",
      config: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save Omada configuration",
    });
  }
});

// 3. Test connection to a supplier
omadaRouter.post("/test-connection", async (req, res) => {
  try {
    const supplierConfig: OmadaSupplierConfig = req.body;
    if (!supplierConfig || !supplierConfig.baseUrl || !supplierConfig.omadaId || !supplierConfig.clientId || !supplierConfig.clientSecret) {
      return res.status(400).json({
        success: false,
        message: "Base URL, Omada ID, Client ID, and Client Secret are all required.",
      });
    }

    const testResult = await omadaService.testConnection(supplierConfig);
    if (!testResult.success) {
      return res.status(400).json(testResult);
    }
    return res.json(testResult);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Connection test failed",
    });
  }
});

// 4. Get all live Omada sites across Supplier 1 and Supplier 2
omadaRouter.get("/sites", async (req, res) => {
  try {
    const includeDevices = req.query.includeDevices === "true";
    const sites = await omadaService.getAllSites(includeDevices);
    res.json({
      success: true,
      count: sites.length,
      sites,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch Omada sites",
    });
  }
});

// 5. Get devices for a specific site
omadaRouter.get("/sites/:supplierId/:siteId/devices", async (req, res) => {
  try {
    const { supplierId, siteId } = req.params;
    if (supplierId !== "supplier1" && supplierId !== "supplier2") {
      return res.status(400).json({
        success: false,
        error: "Invalid supplierId (must be 'supplier1' or 'supplier2')",
      });
    }

    const devices = await omadaService.fetchSiteDevices(supplierId, siteId);
    const clients = await omadaService.fetchSiteClients(supplierId, siteId);

    res.json({
      success: true,
      count: devices.length,
      devices,
      clients,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch site devices",
    });
  }
});

// 6. Sync live Omada data to Turso `freewifi` table
omadaRouter.post("/sync", async (_req, res) => {
  try {
    const syncResult = await omadaService.syncToDatabase();
    res.json(syncResult);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Sync failed",
    });
  }
});

// 7. Get Omada overview statistics
omadaRouter.get("/overview", async (_req, res) => {
  try {
    const overview = await omadaService.getOverview();
    res.json({
      success: true,
      overview,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch overview",
    });
  }
});
