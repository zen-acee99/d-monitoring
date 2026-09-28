import { Router, Request, Response } from "express";
import { db } from "../db.js";

export const dtrScheduleSettingsRouter = Router();

export interface DtrWorkScheduleSetting {
  id: string;
  scheduleName: string;
  workDaysPerWeek: number;
  workDays: string[];
  hoursPerDay: number;
  standardAmArrival: string;
  standardAmDeparture: string;
  standardPmArrival: string;
  standardPmDeparture: string;
  regularHoursLabel: string;
  saturdayHoursLabel: string;
  noWorkDayLabel: string;
  gracePeriodMinutes: number;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

function formatScheduleSettingRow(row: any): DtrWorkScheduleSetting {
  let workDays: string[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  try {
    if (row.work_days_json) {
      workDays = JSON.parse(row.work_days_json);
    }
  } catch {}

  return {
    id: row.id || "main_schedule_setting",
    scheduleName: row.schedule_name || "Standard 5-Day Workweek",
    workDaysPerWeek: Number(row.work_days_per_week) || 5,
    workDays,
    hoursPerDay: Number(row.hours_per_day) || 8,
    standardAmArrival: row.standard_am_arrival || "08:00",
    standardAmDeparture: row.standard_am_departure || "12:00",
    standardPmArrival: row.standard_pm_arrival || "13:00",
    standardPmDeparture: row.standard_pm_departure || "17:00",
    regularHoursLabel: row.regular_hours_label || "8:00 AM - 5:00 PM",
    saturdayHoursLabel: row.saturday_hours_label || "As Required",
    noWorkDayLabel: row.no_work_day_label || "NO WORK: 4-DAY WORKWEEK",
    gracePeriodMinutes: Number(row.grace_period_minutes) || 0,
    isActive: Boolean(row.is_active),
    updatedBy: row.updated_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/dtr-schedule-settings - Get active work schedule setting
dtrScheduleSettingsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(`
      SELECT * FROM dtr_work_schedule_settings 
      WHERE id = 'main_schedule_setting' OR is_active = 1 
      ORDER BY updated_at DESC LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Default 5-day fallback
      const fallback: DtrWorkScheduleSetting = {
        id: "main_schedule_setting",
        scheduleName: "Standard 5-Day Workweek",
        workDaysPerWeek: 5,
        workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        hoursPerDay: 8,
        standardAmArrival: "08:00",
        standardAmDeparture: "12:00",
        standardPmArrival: "13:00",
        standardPmDeparture: "17:00",
        regularHoursLabel: "8:00 AM - 5:00 PM",
        saturdayHoursLabel: "As Required",
        noWorkDayLabel: "NO WORK: 4-DAY WORKWEEK",
        gracePeriodMinutes: 0,
        isActive: true,
      };
      return res.json({ success: true, setting: fallback });
    }

    const setting = formatScheduleSettingRow(result.rows[0]);
    return res.json({ success: true, setting });
  } catch (err: any) {
    console.error("Error loading dtr schedule settings:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to load schedule settings" });
  }
});

// POST /api/dtr-schedule-settings - Upsert work schedule setting
dtrScheduleSettingsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const id = body.id || "main_schedule_setting";
    const scheduleName = (body.scheduleName || body.schedule_name || "Standard 5-Day Workweek").trim();
    const workDaysPerWeek = Number(body.workDaysPerWeek ?? body.work_days_per_week ?? 5);
    const workDays = Array.isArray(body.workDays)
      ? body.workDays
      : Array.isArray(body.work_days)
      ? body.work_days
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const workDaysJson = JSON.stringify(workDays);
    const hoursPerDay = Number(body.hoursPerDay ?? body.hours_per_day ?? 8);
    const standardAmArrival = body.standardAmArrival || body.standard_am_arrival || "08:00";
    const standardAmDeparture = body.standardAmDeparture || body.standard_am_departure || "12:00";
    const standardPmArrival = body.standardPmArrival || body.standard_pm_arrival || "13:00";
    const standardPmDeparture = body.standardPmDeparture || body.standard_pm_departure || "17:00";
    const regularHoursLabel = body.regularHoursLabel || body.regular_hours_label || "8:00 AM - 5:00 PM";
    const saturdayHoursLabel = body.saturdayHoursLabel || body.saturday_hours_label || "As Required";
    const noWorkDayLabel = body.noWorkDayLabel || body.no_work_day_label || "NO WORK: 4-DAY WORKWEEK";
    const gracePeriodMinutes = Number(body.gracePeriodMinutes ?? body.grace_period_minutes ?? 0);
    const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : 1;
    const updatedBy = body.updatedBy || body.updated_by || null;

    await db.execute({
      sql: `INSERT INTO dtr_work_schedule_settings (
              id, schedule_name, work_days_per_week, work_days_json, hours_per_day,
              standard_am_arrival, standard_am_departure, standard_pm_arrival, standard_pm_departure,
              regular_hours_label, saturday_hours_label, no_work_day_label,
              grace_period_minutes, is_active, updated_by, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              schedule_name = excluded.schedule_name,
              work_days_per_week = excluded.work_days_per_week,
              work_days_json = excluded.work_days_json,
              hours_per_day = excluded.hours_per_day,
              standard_am_arrival = excluded.standard_am_arrival,
              standard_am_departure = excluded.standard_am_departure,
              standard_pm_arrival = excluded.standard_pm_arrival,
              standard_pm_departure = excluded.standard_pm_departure,
              regular_hours_label = excluded.regular_hours_label,
              saturday_hours_label = excluded.saturday_hours_label,
              no_work_day_label = excluded.no_work_day_label,
              grace_period_minutes = excluded.grace_period_minutes,
              is_active = excluded.is_active,
              updated_by = excluded.updated_by,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        id,
        scheduleName,
        workDaysPerWeek,
        workDaysJson,
        hoursPerDay,
        standardAmArrival,
        standardAmDeparture,
        standardPmArrival,
        standardPmDeparture,
        regularHoursLabel,
        saturdayHoursLabel,
        noWorkDayLabel,
        gracePeriodMinutes,
        isActive,
        updatedBy,
      ],
    });

    const updatedRes = await db.execute({
      sql: "SELECT * FROM dtr_work_schedule_settings WHERE id = ?",
      args: [id],
    });

    const formatted = formatScheduleSettingRow(updatedRes.rows[0]);
    return res.json({ success: true, setting: formatted });
  } catch (err: any) {
    console.error("Error saving dtr schedule settings:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to save schedule settings" });
  }
});
