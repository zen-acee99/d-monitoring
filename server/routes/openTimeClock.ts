import { Router, Request, Response } from "express";
import https from "https";
import dotenv from "dotenv";

dotenv.config();

export const openTimeClockRouter = Router();

const OTC_COMPANY_ID = process.env.OTC_COMPANY_ID || "94324";
const OTC_API_KEY = process.env.OTC_API_KEY || "jGR7ij1oVYv2wk7AhhnLbEyCqJSP13";
const OTC_BASE_URL = process.env.OTC_BASE_URL || "https://api1.opentimeclock.com";

interface RawTimeCard {
  userFullName: string;
  employeeNumber?: string;
  userName: string;
  inDateTime: string; // "YYYY-MM-DD HH:MM:SS"
  outDateTime?: string; // "YYYY-MM-DD HH:MM:SS"
  hours?: number;
  [key: string]: any;
}

interface OtcUserRecord {
  userFullName: string;
  userName: string;
  digitId?: string;
  employeeNumber?: string;
  email?: string;
  mobilePhone?: string;
  role?: string;
  departmentName?: string;
  [key: string]: any;
}

// In-memory cache for registered OTC users to minimize remote latency
let cachedOtcUsers: OtcUserRecord[] = [];
let lastUserCacheTime = 0;

/**
 * Fetch all registered users from Open Time Clock (companyId: 94324)
 */
async function queryOtcUsers(): Promise<OtcUserRecord[]> {
  let allUsers: OtcUserRecord[] = [];
  let next = "0";
  let iterations = 0;

  while (iterations < 6) {
    iterations++;
    const url = `${OTC_BASE_URL.replace(/\/$/, "")}/Jun-Inside-VPC`;
    const payload = JSON.stringify({
      cmd: "api/t1QueryUsers",
      companyId: OTC_COMPANY_ID,
      developerToken: OTC_API_KEY,
      nextRecord: next,
      maxRecords: "500",
    });

    const resData: any = await new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Failed to parse OTC users response: ${body.slice(0, 200)}`));
            }
          });
        }
      );
      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });

    if (resData && Array.isArray(resData.data)) {
      allUsers = allUsers.concat(resData.data);
      if (resData.nextRecord && resData.nextRecord !== "0" && resData.nextRecord !== "-1" && resData.nextRecord !== next) {
        next = String(resData.nextRecord);
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return allUsers;
}

async function getCachedOtcUsers(): Promise<OtcUserRecord[]> {
  const now = Date.now();
  if (cachedOtcUsers.length > 0 && now - lastUserCacheTime < 10 * 60 * 1000) {
    return cachedOtcUsers;
  }
  try {
    const fetched = await queryOtcUsers();
    if (fetched.length > 0) {
      cachedOtcUsers = fetched;
      lastUserCacheTime = now;
    }
  } catch (err) {
    console.warn("Could not refresh OTC users cache:", err);
  }
  return cachedOtcUsers;
}

/**
 * Robust user matcher for OTC accounts
 */
function findOtcUser(users: OtcUserRecord[], queryTerm: string): OtcUserRecord | null {
  if (!queryTerm) return null;
  const q = queryTerm.toLowerCase().trim();
  const qClean = q.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();

  // 1. Exact match on username or full name
  const exact = users.find((u) => {
    const uName = (u.userName || "").toLowerCase().trim();
    const fName = (u.userFullName || "").toLowerCase().trim();
    return uName === q || fName === q;
  });
  if (exact) return exact;

  // 2. Normalized clean match
  const cleanMatch = users.find((u) => {
    const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    return uNameClean === qClean || fNameClean === qClean;
  });
  if (cleanMatch) return cleanMatch;

  // 3. Substring / email / employee number match
  return (
    users.find((u) => {
      const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      const empNo = (u.employeeNumber || "").toLowerCase().trim();
      const email = (u.email || "").toLowerCase().trim();

      return (
        empNo === q ||
        email === q ||
        (qClean.length >= 3 && (fNameClean.includes(qClean) || qClean.includes(fNameClean))) ||
        (qClean.length >= 3 && (uNameClean.includes(qClean) || qClean.includes(uNameClean)))
      );
    }) || null
  );
}

/**
 * Helper to query Open Time Clock time cards
 */
async function queryOtcTimeCards(
  fromDateTime: string,
  toDateTime: string,
  userFullName: string = "ALL USERS"
): Promise<RawTimeCard[]> {
  const url = `${OTC_BASE_URL.replace(/\/$/, "")}/Jun-Inside-VPC`;
  const payload = JSON.stringify({
    cmd: "api/t1QueryTimeCards",
    companyId: OTC_COMPANY_ID,
    developerToken: OTC_API_KEY,
    nextRecord: "0",
    dateTimeFrom: fromDateTime,
    dateTimeTo: toDateTime,
    userFullName: userFullName || "ALL USERS",
    departmentName: "ALL DEPARTMENTS",
    maxRecords: "5000",
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed.data)) {
              resolve(parsed.data as RawTimeCard[]);
            } else if (parsed.statusCode === "ERROR") {
              reject(new Error(parsed.message || "OTC API returned an error"));
            } else {
              resolve([]);
            }
          } catch (e) {
            reject(new Error(`Failed to parse OTC response: ${body.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

import crypto from "crypto";

/**
 * Strict authentication & verification for Open Time Clock users
 */
async function verifyOtcUserAuth(
  username: string,
  password?: string
): Promise<{
  success: boolean;
  authenticated: boolean;
  user?: OtcUserRecord;
  error?: string;
}> {
  if (!username || !username.trim()) {
    return { success: false, authenticated: false, error: "Username is required." };
  }

  const allUsers = await getCachedOtcUsers();
  const foundUser = findOtcUser(allUsers, username.trim());

  if (!foundUser) {
    return {
      success: false,
      authenticated: false,
      error: `❌ Invalid Open Time Clock Account: Username "${username.trim()}" was not found in Company ID 94324. Please check your username.`,
    };
  }

  // If password is provided, perform strict authentication check against Open Time Clock T1 API
  if (password && password.trim()) {
    const md5Password = crypto.createHash("md5").update(password.trim()).digest("hex").toLowerCase();
    const payload = JSON.stringify({
      cmd: "web/sGetOneUserInfo",
      companyId: OTC_COMPANY_ID,
      action: "checkLogin",
      userName: foundUser.userName,
      md5Password: md5Password,
    });

    try {
      const authRes: any = await new Promise((resolve, reject) => {
        const req = https.request(
          "https://api1.opentimeclock.com/T1-TimeClockFree",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                resolve(body);
              }
            });
          }
        );
        req.on("error", (err) => reject(err));
        req.write(payload);
        req.end();
      });

      if (authRes === "PASSWORDERROR") {
        return {
          success: false,
          authenticated: false,
          error: `❌ Incorrect Password: The password provided for Open Time Clock account "${foundUser.userName}" is incorrect. Please verify your credentials.`,
        };
      }

      if (authRes === "USERNAMEERROR") {
        return {
          success: false,
          authenticated: false,
          error: `❌ Account Error: Username "${foundUser.userName}" was not recognized by Open Time Clock authentication.`,
        };
      }
    } catch (authErr: any) {
      console.warn("Could not reach OTC T1 auth service:", authErr);
    }
  }

  return {
    success: true,
    authenticated: true,
    user: foundUser,
  };
}

/**
 * POST /api/opentimeclock/verify
 * Validates whether user credentials exist in Open Time Clock (Company ID: 94324)
 */
openTimeClockRouter.post("/verify", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: "Username is required." });
    }

    const authResult = await verifyOtcUserAuth(username, password);

    if (!authResult.success || !authResult.user) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: authResult.error || "Authentication failed with Open Time Clock.",
      });
    }

    const foundUser = authResult.user;

    return res.json({
      success: true,
      authenticated: true,
      employeeName: foundUser.userFullName,
      userName: foundUser.userName,
      employeeNumber: foundUser.employeeNumber || "",
      departmentName: foundUser.departmentName || "",
      message: `✓ Open Time Clock credentials verified for ${foundUser.userFullName} (${foundUser.userName})`,
    });
  } catch (error: any) {
    console.error("OTC verify error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to verify with Open Time Clock" });
  }
});

/**
 * POST /api/opentimeclock/fetch
 * Fetches timecards for the user for the specified month, year, and action scope
 */
openTimeClockRouter.post("/fetch", async (req: Request, res: Response) => {
  try {
    const { username, password, month = 7, year = 2026, scope = "full", employeeName } = req.body;

    if (!username && !employeeName) {
      return res.status(400).json({ success: false, error: "Username or employee name is required" });
    }

    const userTerm = (username || employeeName || "").trim();
    const authResult = await verifyOtcUserAuth(userTerm, password);

    if (!authResult.success && username) {
      return res.status(401).json({
        success: false,
        error: authResult.error || `❌ Open Time Clock authentication failed for "${username}". Please check your credentials.`,
      });
    }

    const foundUser = authResult.user;

    const targetFullName = foundUser ? foundUser.userFullName : employeeName || username;
    const targetUserName = foundUser ? foundUser.userName : username;

    const monthNum = parseInt(String(month), 10);
    const yearNum = parseInt(String(year), 10);
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");

    const fromDateTime = `${yearNum}-${pad(monthNum + 1)}-01 00:00:00`;
    const toDateTime = `${yearNum}-${pad(monthNum + 1)}-${pad(daysInMonth)} 23:59:59`;

    // First attempt: Direct query with exact user full name for best speed
    let records = await queryOtcTimeCards(fromDateTime, toDateTime, targetFullName);

    // If direct query returned 0, fallback to querying ALL USERS and filtering
    if (records.length === 0) {
      const allRecords = await queryOtcTimeCards(fromDateTime, toDateTime, "ALL USERS");
      const searchTerms = [targetFullName, targetUserName, username, employeeName]
        .filter(Boolean)
        .map((s: string) => s.toLowerCase().trim());

      records = allRecords.filter((r) => {
        const u = (r.userName || "").toLowerCase().trim();
        const f = (r.userFullName || "").toLowerCase().trim();
        const emp = (r.employeeNumber || "").toLowerCase().trim();

        return searchTerms.some((term) => {
          if (!term) return false;
          return u === term || f === term || f.includes(term) || term.includes(f) || (emp && emp === term);
        });
      });
    }

    // Group punches by day of the month
    const byDay: Record<number, RawTimeCard[]> = {};
    records.forEach((punch) => {
      if (!punch.inDateTime) return;
      const datePart = punch.inDateTime.split(" ")[0];
      const day = parseInt(datePart.split("-")[2], 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(punch);
    });

    // Construct 31 DTR rows
    const dtrRows = [];
    for (let d = 1; d <= 31; d++) {
      if (d > daysInMonth) {
        dtrRows.push({
          day: d,
          amArrival: "",
          amDeparture: "",
          pmArrival: "",
          pmDeparture: "",
          undertimeHours: "",
          undertimeMinutes: "",
          isCustomLabel: false,
          customLabel: "",
        });
        continue;
      }

      // Check if excluded by Action Scope
      if (scope === "first-half" && d > 15) {
        dtrRows.push({
          day: d,
          amArrival: "",
          amDeparture: "",
          pmArrival: "",
          pmDeparture: "",
          undertimeHours: "",
          undertimeMinutes: "",
          isCustomLabel: false,
          customLabel: "",
        });
        continue;
      }

      if (scope === "second-half" && d < 16) {
        dtrRows.push({
          day: d,
          amArrival: "",
          amDeparture: "",
          pmArrival: "",
          pmDeparture: "",
          undertimeHours: "",
          undertimeMinutes: "",
          isCustomLabel: false,
          customLabel: "",
        });
        continue;
      }

      const dayPunches = byDay[d] || [];
      let amIn = "";
      let amOut = "";
      let pmIn = "";
      let pmOut = "";

      // Sort punches chronologically by inDateTime
      dayPunches.sort((a, b) => a.inDateTime.localeCompare(b.inDateTime));

      dayPunches.forEach((p) => {
        const inTime = p.inDateTime ? p.inDateTime.split(" ")[1].substring(0, 5) : "";
        const outTime = p.outDateTime && !p.outDateTime.startsWith("0000") ? p.outDateTime.split(" ")[1].substring(0, 5) : "";

        const inHour = inTime ? parseInt(inTime.split(":")[0], 10) : -1;
        const outHour = outTime ? parseInt(outTime.split(":")[0], 10) : -1;

        if (inHour >= 0 && inHour < 12) {
          if (!amIn) amIn = inTime;
          if (outTime) {
            if (outHour <= 12 || (outHour === 13 && parseInt(outTime.split(":")[1], 10) === 0)) {
              amOut = outTime;
            } else {
              amOut = "12:00";
              pmIn = "13:00";
              pmOut = outTime;
            }
          }
        } else if (inHour >= 12) {
          if (!pmIn) pmIn = inTime;
          if (outTime) pmOut = outTime;
        }
      });

      dtrRows.push({
        day: d,
        amArrival: amIn,
        amDeparture: amOut,
        pmArrival: pmIn,
        pmDeparture: pmOut,
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: false,
        customLabel: "",
      });
    }

    const detectedEmployeeName = targetFullName;
    const detectedUserName = targetUserName;
    const detectedEmployeeNumber = foundUser?.employeeNumber || records[0]?.employeeNumber || "";

    return res.json({
      success: true,
      employeeName: detectedEmployeeName,
      userName: detectedUserName,
      employeeNumber: detectedEmployeeNumber,
      totalPunches: records.length,
      scope,
      month: monthNum,
      year: yearNum,
      rows: dtrRows,
      message: `Successfully verified and fetched ${records.length} punches from Open Time Clock for ${detectedEmployeeName}!`,
    });
  } catch (error: any) {
    console.error("OTC fetch error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch timecards from Open Time Clock" });
  }
});
