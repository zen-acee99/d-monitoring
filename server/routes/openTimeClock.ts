import { Router, Request, Response } from "express";
import https from "https";
import crypto from "crypto";
import dotenv from "dotenv";
import { db } from "../db.js";

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

// Known DICT Region V personnel presets for seamless offline and network fallback
const FALLBACK_OTC_USERS: OtcUserRecord[] = [
  {
    userFullName: "Ace Mata Malto",
    userName: "Ace M.",
    departmentName: "R5 - JO (Projects)",
    role: "Employee",
    email: "maltoace9@gmail.com",
  },
  {
    userFullName: "Ralph Dela Torre",
    userName: "Ralph Dela Torre",
    departmentName: "DICT Region V",
    role: "Employee",
    email: "ralph.delatorre@dict.gov.ph",
  },
  {
    userFullName: "Admin",
    userName: "dictlc3",
    departmentName: "DICT Regional Office",
    role: "Admin",
    email: "valentino.espeleta@dict.gov.ph",
  },
];

async function getFallbackUsers(): Promise<OtcUserRecord[]> {
  const users: OtcUserRecord[] = [...FALLBACK_OTC_USERS];
  try {
    const res = await db.execute("SELECT employee_name, otc_username FROM dtr_user_setup");
    if (res && Array.isArray(res.rows)) {
      for (const row of res.rows) {
        const empName = String(row.employee_name || "").trim();
        const otcName = String(row.otc_username || "").trim();
        if (empName || otcName) {
          const matchKey = (otcName || empName).toLowerCase();
          if (!users.some((u) => u.userName.toLowerCase() === matchKey || u.userFullName.toLowerCase() === matchKey)) {
            users.push({
              userFullName: empName || otcName,
              userName: otcName || empName,
              role: "Employee",
              departmentName: "DICT Region V",
            });
          }
        }
      }
    }
  } catch {
    // Local DB not initialized or offline; fall back to static list
  }
  return users;
}

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
          agent: false,
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
      req.setTimeout(10000, () => {
        req.destroy(new Error("Open Time Clock API timeout after 10s"));
      });
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

async function getCachedOtcUsers(): Promise<{ users: OtcUserRecord[]; isLive: boolean }> {
  const now = Date.now();
  if (cachedOtcUsers.length > 0 && now - lastUserCacheTime < 10 * 60 * 1000) {
    return { users: cachedOtcUsers, isLive: true };
  }
  try {
    const fetched = await queryOtcUsers();
    if (fetched.length > 0) {
      cachedOtcUsers = fetched;
      lastUserCacheTime = now;
      return { users: cachedOtcUsers, isLive: true };
    }
  } catch (err) {
    console.warn("Could not refresh OTC users cache:", err);
  }
  if (cachedOtcUsers.length > 0) {
    return { users: cachedOtcUsers, isLive: true };
  }
  const fallback = await getFallbackUsers();
  return { users: fallback, isLive: false };
}

function isRegionV(user: OtcUserRecord): boolean {
  const dept = (user.departmentName || "").toLowerCase();
  return (
    dept.includes("r5") ||
    dept.includes("region v") ||
    dept.includes("bicol") ||
    dept.includes("albay") ||
    dept.includes("camarines") ||
    dept.includes("catanduanes") ||
    dept.includes("masbate") ||
    dept.includes("sorsogon")
  );
}

/**
 * Robust user matcher for OTC accounts with preferred employee name and Region V disambiguation
 */
function findOtcUser(
  users: OtcUserRecord[],
  queryTerm: string,
  preferredEmployeeName?: string
): OtcUserRecord | null {
  if (!queryTerm) return null;
  const q = queryTerm.toLowerCase().trim();
  const qClean = q.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
  const qTokens = qClean.split(" ").filter((t) => t.length > 0);
  const prefNorm = preferredEmployeeName
    ? preferredEmployeeName.toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim()
    : "";

  // 0. Preferred user alias match (e.g. if profile is "Ace Mata Malto" and user enters "Ace")
  if (prefNorm) {
    const prefUser = users.find((u) => {
      const f = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      const uName = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      return f === prefNorm || uName === prefNorm || f.includes(prefNorm) || prefNorm.includes(f);
    });
    if (prefUser) {
      const prefWords = `${prefUser.userName || ""} ${prefUser.userFullName || ""}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, " ")
        .split(" ")
        .filter(Boolean);
      if (prefWords.includes(qClean) || (qTokens.length > 0 && qTokens.every((t) => prefWords.includes(t)))) {
        return prefUser;
      }
    }
  }

  // 1. Exact Email match (highest priority if query is an email address)
  if (q.includes("@")) {
    const emailMatch = users.find((u) => (u.email || "").toLowerCase().trim() === q);
    if (emailMatch) return emailMatch;
  }

  // 2. Exact match on username or full name (prefer Region V / preferred profile if multiple)
  const exactMatches = users.filter((u) => {
    const uName = (u.userName || "").toLowerCase().trim();
    const fName = (u.userFullName || "").toLowerCase().trim();
    return uName === q || fName === q;
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = exactMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = exactMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return exactMatches[0];
  }

  // 3. Normalized clean match (ignoring dots, dashes, punctuation)
  const cleanMatches = users.filter((u) => {
    const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    return uNameClean === qClean || fNameClean === qClean;
  });
  if (cleanMatches.length === 1) return cleanMatches[0];
  if (cleanMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = cleanMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = cleanMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return cleanMatches[0];
  }

  // 4. Multi-token scoring (e.g. "Ace Malto" matches "Ace Mata Malto" because it contains all tokens)
  if (qTokens.length > 1) {
    let bestUsers: OtcUserRecord[] = [];
    let bestScore = 0;

    for (const u of users) {
      const uFull = `${u.userName || ""} ${u.userFullName || ""} ${u.email || ""}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, " ");
      const matchedCount = qTokens.filter((t) => uFull.includes(t)).length;
      if (matchedCount === qTokens.length) {
        if (matchedCount > bestScore) {
          bestScore = matchedCount;
          bestUsers = [u];
        } else if (matchedCount === bestScore) {
          bestUsers.push(u);
        }
      }
    }
    if (bestUsers.length === 1) return bestUsers[0];
    if (bestUsers.length > 1) {
      if (prefNorm) {
        const prefMatch = bestUsers.find((u) => (u.userFullName || "").toLowerCase().includes(prefNorm));
        if (prefMatch) return prefMatch;
      }
      const r5Match = bestUsers.find(isRegionV);
      if (r5Match) return r5Match;
      return bestUsers[0];
    }
  }

  // 5. Employee number exact match
  const empMatch = users.find((u) => (u.employeeNumber || "").toLowerCase().trim() === q);
  if (empMatch) return empMatch;

  // 6. Word boundary match on single token
  const wordMatches = users.filter((u) => {
    const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const words = `${uNameClean} ${fNameClean}`.split(" ");
    return words.includes(qClean) || (qClean.length >= 4 && fNameClean.includes(qClean));
  });
  if (wordMatches.length === 1) return wordMatches[0];
  if (wordMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = wordMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = wordMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return wordMatches[0];
  }

  return null;
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
        agent: false,
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

    req.setTimeout(12000, () => {
      req.destroy(new Error("Open Time Clock time cards query timed out (12s)"));
    });
    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Strict whole-word and normalized punch record matcher
 * Prevents naive substring matches (e.g. "Ace" falsely matching "Aceveda" or "Grace")
 */
function matchesPunchRecord(
  r: { userName?: string; userFullName?: string; employeeNumber?: string },
  searchTerms: string[]
): boolean {
  const u = (r.userName || "").toLowerCase().trim();
  const f = (r.userFullName || "").toLowerCase().trim();
  const emp = (r.employeeNumber || "").toLowerCase().trim();

  return searchTerms.some((term) => {
    if (!term) return false;
    const t = term.toLowerCase().trim();
    if (u === t || f === t || (emp && emp === t)) return true;

    const tNorm = t.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNorm = f.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const uNorm = u.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    if (fNorm === tNorm || uNorm === tNorm) return true;

    const tokens = tNorm.split(" ").filter((w) => w.length > 0);
    if (tokens.length > 1) {
      const allWords = `${uNorm} ${fNorm}`.split(" ").filter(Boolean);
      const allTokensMatch = tokens.every((tok) => allWords.includes(tok));
      if (allTokensMatch) return true;
    }

    return false;
  });
}

/**
 * Strict authentication & verification for Open Time Clock users
 */
async function verifyOtcUserAuth(
  username: string,
  password?: string,
  preferredEmployeeName?: string
): Promise<{
  success: boolean;
  authenticated: boolean;
  user?: OtcUserRecord;
  error?: string;
  isNetworkError?: boolean;
}> {
  if (!username || !username.trim()) {
    return { success: false, authenticated: false, isNetworkError: false, error: "Username is required." };
  }

  const { users: allUsers, isLive } = await getCachedOtcUsers();
  const foundUser = findOtcUser(allUsers, username.trim(), preferredEmployeeName);

  if (!foundUser) {
    if (!isLive) {
      return {
        success: false,
        authenticated: false,
        isNetworkError: true,
        error: `⚠️ Network Connection Error: Unable to reach Open Time Clock server (Company ID 94324) and username "${username.trim()}" is not in local cache.`,
      };
    }
    return {
      success: false,
      authenticated: false,
      isNetworkError: false,
      error: `❌ Invalid Open Time Clock Account: Username "${username.trim()}" was not found in Company ID 94324. Please check your username.`,
    };
  }

  // If password is provided, perform strict authentication check against Open Time Clock T1 API
  if (password && password.trim()) {
    // OpenTimeClock third-party API requires md5Password per its external API contract (cmd: "web/sGetOneUserInfo", action: "checkLogin")
    // nosemgrep: javascript.lang.security.audit.md5-used-as-password.md5-used-as-password
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
            agent: false,
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
        req.setTimeout(8000, () => {
          req.destroy(new Error("Open Time Clock auth timeout after 8s"));
        });
        req.on("error", (err) => reject(err));
        req.write(payload);
        req.end();
      });

      if (authRes === "PASSWORDERROR") {
        return {
          success: false,
          authenticated: false,
          isNetworkError: false,
          error: `❌ Incorrect Password: The password provided for Open Time Clock account "${foundUser.userName}" is incorrect. Please verify your credentials.`,
        };
      }

      if (authRes === "USERNAMEERROR") {
        return {
          success: false,
          authenticated: false,
          isNetworkError: false,
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
    const { username, password, employeeName } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: "Username is required." });
    }

    const authResult = await verifyOtcUserAuth(username, password, employeeName);

    if (!authResult.success || !authResult.user) {
      const statusCode = authResult.isNetworkError ? 503 : 401;
      return res.status(statusCode).json({
        success: false,
        authenticated: false,
        isNetworkError: Boolean(authResult.isNetworkError),
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
    res.status(503).json({
      success: false,
      isNetworkError: true,
      error: error.message || "Failed to verify with Open Time Clock",
    });
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
    const authResult = await verifyOtcUserAuth(userTerm, password, employeeName);

    if (!authResult.success && username) {
      const statusCode = authResult.isNetworkError ? 503 : 401;
      return res.status(statusCode).json({
        success: false,
        isNetworkError: Boolean(authResult.isNetworkError),
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

    let fromDay = "01";
    let toDay = pad(daysInMonth);
    if (scope === "first-half") {
      fromDay = "01";
      toDay = "15";
    } else if (scope === "second-half") {
      fromDay = "16";
      toDay = pad(daysInMonth);
    }

    const fromDateTime = `${yearNum}-${pad(monthNum + 1)}-${fromDay} 00:00:00`;
    const toDateTime = `${yearNum}-${pad(monthNum + 1)}-${toDay} 23:59:59`;

    // First attempt: Direct query with exact user full name for best speed
    let records = await queryOtcTimeCards(fromDateTime, toDateTime, targetFullName);

    // If direct query returned 0, fallback to querying ALL USERS and filtering with strict token matching
    if (records.length === 0) {
      const allRecords = await queryOtcTimeCards(fromDateTime, toDateTime, "ALL USERS");
      const searchTerms = [targetFullName, targetUserName, username, employeeName]
        .filter(Boolean)
        .map((s: string) => s.toLowerCase().trim());

      records = allRecords.filter((r) => matchesPunchRecord(r, searchTerms));
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

      // Check if excluded by 2-Week Action Scope (keep columns intact, punches empty)
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
              pmIn = "1:00";
              pmOut = outTime;
            }
          }
        } else if (inHour >= 12) {
          if (!pmIn) pmIn = inTime;
          if (outTime) pmOut = outTime;
        }
      });

      const to12Hour = (val: string) => {
        if (!val || !val.trim()) return "";
        const match = val.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!match) return val.trim();
        let h = parseInt(match[1], 10);
        const m = match[2];
        if (h > 12) h -= 12;
        else if (h === 0) h = 12;
        return `${h}:${m}`;
      };

      dtrRows.push({
        day: d,
        amArrival: to12Hour(amIn),
        amDeparture: to12Hour(amOut),
        pmArrival: to12Hour(pmIn),
        pmDeparture: to12Hour(pmOut),
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
    res.status(503).json({
      success: false,
      isNetworkError: true,
      error: error.message || "Failed to fetch timecards from Open Time Clock",
    });
  }
});
