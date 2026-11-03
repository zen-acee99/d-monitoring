import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse CSV with proper RFC 4180 handling for quotes and multiline fields
function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      row.push(cur.trim());
      cur = '';
      if (row.some(field => field.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      cur += c;
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(field => field.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

const csvFilePath = path.join(__dirname, 'raw_egov_data.csv');
const rawContent = fs.readFileSync(csvFilePath, 'utf-8');

// Split sections
const parts = rawContent.split(/===SECTION_BREAK_[A-Z]+===/);
const activitiesText = parts[0] || '';
const ticketsText = parts[1] || '';
const egovpayText = parts[2] || '';

console.log(`Parsing activities raw length: ${activitiesText.length}`);
console.log(`Parsing tickets raw length: ${ticketsText.length}`);
console.log(`Parsing egovpay raw length: ${egovpayText.length}`);

const activitiesRows = parseCSV(activitiesText);
const ticketsRows = parseCSV(ticketsText);
const egovpayRows = parseCSV(egovpayText);

console.log(`Parsed activities rows: ${activitiesRows.length}`);
console.log(`Parsed tickets rows: ${ticketsRows.length}`);
console.log(`Parsed egovpay rows: ${egovpayRows.length}`);

// Activity headers: activitiesRows[0]
// Row 1 to activitiesRows.length - 1 are data rows
const activities = [];
for (let i = 1; i < activitiesRows.length; i++) {
  const r = activitiesRows[i];
  if (!r || r.length < 5 || !r[0]) continue;

  const rowNo = parseInt(r[0], 10);
  if (isNaN(rowNo)) continue;

  const month = r[1] || '';
  const province = (r[2] || '').trim();
  const municipality = (r[3] || '').trim();
  const activityTitle = (r[4] || '').trim();
  const venue = (r[5] || '').trim();
  const partnerName = (r[6] || '').trim();
  const startDate = (r[7] || '').trim();
  const endDate = (r[8] || '').trim();
  const typeOfActivity = (r[9] || 'Orientation').trim();

  // Sectors
  const nga = parseInt(r[10], 10) || 0;
  const lgu = parseInt(r[11], 10) || 0;
  const othersSector = parseInt(r[12], 10) || 0;

  // Gender counts
  const ngaMale = parseInt(r[13], 10) || 0;
  const ngaFemale = parseInt(r[14], 10) || 0;
  const lguMale = parseInt(r[15], 10) || 0;
  const lguFemale = parseInt(r[16], 10) || 0;
  const sucMale = parseInt(r[17], 10) || 0;
  const sucFemale = parseInt(r[18], 10) || 0;
  const othersMale = parseInt(r[19], 10) || 0;
  const othersFemale = parseInt(r[20], 10) || 0;

  const maleAttendees = ngaMale + lguMale + sucMale + othersMale;
  const femaleAttendees = ngaFemale + lguFemale + sucFemale + othersFemale;
  let totalAttendees = maleAttendees + femaleAttendees;
  if (totalAttendees === 0 && (nga + lgu + othersSector) > 0) {
    totalAttendees = nga + lgu + othersSector;
  }

  const afterActivityReport = (r[21] || '').trim();
  const todaInput = (r[22] || '').trim();
  const dictPersonnel = (r[23] || '').trim();
  const fbPostingUrl = (r[24] || '').trim();
  const rawPhotos = (r[25] || '').trim();

  activities.push({
    id: `egov-act-${String(rowNo).padStart(3, '0')}`,
    rowNo,
    month,
    province,
    municipality,
    activityTitle,
    venue,
    partnerName: partnerName === 'None' ? '' : partnerName,
    startDate,
    endDate,
    typeOfActivity,
    nga,
    lgu,
    othersSector,
    ngaMale,
    ngaFemale,
    lguMale,
    lguFemale,
    sucMale,
    sucFemale,
    othersMale,
    othersFemale,
    maleAttendees,
    femaleAttendees,
    totalAttendees,
    afterActivityReport,
    todaInput,
    dictPersonnel,
    fbPostingUrl,
    rawPhotos,
    status: 'Completed',
  });
}

console.log(`Structured ${activities.length} activity records.`);

// Process Tickets
const tickets = [];
for (let i = 1; i < ticketsRows.length; i++) {
  const r = ticketsRows[i];
  if (!r || r.length < 5 || !r[0]) continue;

  const ticketNo = (r[0] || '').trim();
  if (!ticketNo.startsWith('R5-')) continue;

  const timestamp = (r[1] || '').trim();
  const email = (r[3] || '').trim();
  const contactNo = (r[4] || '').trim();
  const lastName = (r[5] || '').trim();
  const firstName = (r[6] || '').trim();
  const middleName = (r[7] || '').trim();
  const clientName = [firstName, middleName, lastName].filter(Boolean).join(' ') || (r[5] || 'Citizen');
  const gender = (r[8] || '').trim();
  const suffix = (r[9] || '').trim();
  const dob = (r[10] || '').trim();
  const address = (r[11] || '').trim();
  const kindOfRequest = (r[12] || '').trim();
  const pcnTrn = (r[13] || '').trim();
  const issueDescription = (r[18] || r[27] || kindOfRequest || 'General Assistance').trim();

  // Mode, status, assisted by
  const modeOfAssistance = (r[39] || 'Assisted in person').trim();
  let actionTaken = (r[40] || 'RESOLVED').trim();
  if (actionTaken.toUpperCase() === 'RESOVED') actionTaken = 'RESOLVED';
  const statusUpdated = (r[41] || '').trim();
  const assistedBy = (r[42] || '').trim();
  const remarks = (r[43] || '').trim();
  const coTicketNo = (r[44] || '').trim();

  tickets.push({
    id: ticketNo,
    ticketNo,
    timestamp,
    email,
    contactNo,
    clientName,
    lastName,
    firstName,
    middleName,
    gender,
    suffix,
    dob,
    address,
    kindOfRequest,
    pcnTrn,
    issueDescription,
    modeOfAssistance,
    status: actionTaken,
    statusUpdated,
    assistedBy,
    remarks,
    coTicketNo,
  });
}

console.log(`Structured ${tickets.length} support ticket records.`);

// Process eGovPay
const egovpay = [];
for (let i = 1; i < egovpayRows.length; i++) {
  const r = egovpayRows[i];
  if (!r || r.length < 4 || !r[0]) continue;

  const rowNo = parseInt(r[0], 10);
  if (isNaN(rowNo)) continue;

  const month = (r[1] || '').trim();
  const lguName = (r[2] || '').trim();
  const activityName = (r[3] || '').trim();
  const venue = (r[4] || '').trim();
  const startDate = (r[5] || '').trim();
  const endDate = (r[6] || '').trim();
  const maleAttendees = parseInt(r[7], 10) || 0;
  const femaleAttendees = parseInt(r[8], 10) || 0;
  const totalAttendees = maleAttendees + femaleAttendees;
  const afterActivityReport = (r[9] || '').trim();
  const dictPersonnel = (r[11] || '').trim();
  const fbPostingUrl = (r[12] || '').trim();

  egovpay.push({
    id: `egovpay-${String(rowNo).padStart(2, '0')}`,
    rowNo,
    month,
    lguName,
    activityName,
    venue,
    startDate,
    endDate,
    maleAttendees,
    femaleAttendees,
    totalAttendees,
    afterActivityReport,
    dictPersonnel,
    fbPostingUrl,
    status: 'Completed',
  });
}

console.log(`Structured ${egovpay.length} eGovPay records.`);

// Generate src/data/egovphData.ts
const targetDataPath = path.resolve(__dirname, '../src/data/egovphData.ts');

const tsCode = `/**
 * Official eGovPH Data Store for DICT Region V
 * Auto-generated from official regional monitoring records
 */

export interface EgovphActivity {
  id: string;
  rowNo: number;
  month: string;
  province: string;
  municipality: string;
  activityTitle: string;
  venue: string;
  partnerName: string;
  startDate: string;
  endDate: string;
  typeOfActivity: "Orientation" | "Promotional Activity" | "Orientation with Promotional Activity" | string;
  nga?: number;
  lgu?: number;
  othersSector?: number;
  ngaMale?: number;
  ngaFemale?: number;
  lguMale?: number;
  lguFemale?: number;
  sucMale?: number;
  sucFemale?: number;
  othersMale?: number;
  othersFemale?: number;
  maleAttendees: number;
  femaleAttendees: number;
  totalAttendees: number;
  afterActivityReport?: string;
  todaInput?: string;
  dictPersonnel: string;
  fbPostingUrl?: string;
  rawPhotos?: string;
  status: "Completed" | "Ongoing" | "Scheduled" | string;
  remarks?: string;
}

export interface EgovphTicket {
  id: string;
  ticketNo: string;
  timestamp: string;
  email: string;
  contactNo: string;
  clientName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  gender: string;
  suffix?: string;
  dob?: string;
  address?: string;
  kindOfRequest: string;
  pcnTrn?: string;
  issueDescription: string;
  modeOfAssistance: string;
  status: "RESOLVED" | "ESCALATED" | "Pending" | "Duplicate Entry" | string;
  statusUpdated?: string;
  assistedBy: string;
  remarks?: string;
  coTicketNo?: string;
}

export interface EgovPayActivity {
  id: string;
  rowNo: number;
  month: string;
  lguName: string;
  activityName: string;
  venue: string;
  startDate: string;
  endDate: string;
  maleAttendees: number;
  femaleAttendees: number;
  totalAttendees: number;
  afterActivityReport?: string;
  dictPersonnel: string;
  fbPostingUrl?: string;
  status: string;
}

export const EGOVPH_ACTIVITIES_DATA: EgovphActivity[] = ${JSON.stringify(activities, null, 2)};

export const EGOVPH_TICKETS_DATA: EgovphTicket[] = ${JSON.stringify(tickets, null, 2)};

export const EGOVPAY_ACTIVITIES_DATA: EgovPayActivity[] = ${JSON.stringify(egovpay, null, 2)};

export const EGOVPH_PROVINCES = [
  "Albay",
  "Camarines Sur",
  "Camarines Norte",
  "Catanduanes",
  "Masbate",
  "Sorsogon"
] as const;

export function getEgovphSummary(activities: EgovphActivity[] = EGOVPH_ACTIVITIES_DATA, tickets: EgovphTicket[] = EGOVPH_TICKETS_DATA, egovpay: EgovPayActivity[] = EGOVPAY_ACTIVITIES_DATA) {
  const totalActivities = activities.length;
  const totalAttendees = activities.reduce((acc, curr) => acc + (curr.totalAttendees || 0), 0);
  const totalMale = activities.reduce((acc, curr) => acc + (curr.maleAttendees || 0), 0);
  const totalFemale = activities.reduce((acc, curr) => acc + (curr.femaleAttendees || 0), 0);

  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter(t => t.status === "RESOLVED" || t.status === "RESOVED").length;
  const escalatedTickets = tickets.filter(t => t.status === "ESCALATED").length;
  const pendingTickets = tickets.filter(t => t.status === "Pending").length;
  const duplicateTickets = tickets.filter(t => t.status === "Duplicate Entry").length;

  const resolutionRate = totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(1) : "0";

  const totalEgovPayActivities = egovpay.length;
  const egovPayAttendees = egovpay.reduce((acc, curr) => acc + (curr.totalAttendees || 0), 0);

  return {
    totalActivities,
    totalAttendees,
    totalMale,
    totalFemale,
    totalTickets,
    resolvedTickets,
    escalatedTickets,
    pendingTickets,
    duplicateTickets,
    resolutionRate: Number(resolutionRate),
    totalEgovPayActivities,
    egovPayAttendees,
  };
}

export function getEgovphProvincialBreakdown(activities: EgovphActivity[] = EGOVPH_ACTIVITIES_DATA) {
  const map: Record<string, { activities: number; attendees: number; male: number; female: number; orientations: number; promotions: number }> = {};
  
  for (const prov of EGOVPH_PROVINCES) {
    map[prov] = { activities: 0, attendees: 0, male: 0, female: 0, orientations: 0, promotions: 0 };
  }

  for (const act of activities) {
    let prov = act.province;
    // Normalize province if needed
    for (const p of EGOVPH_PROVINCES) {
      if (prov.toLowerCase().includes(p.toLowerCase())) {
        prov = p;
        break;
      }
    }
    if (!map[prov]) {
      map[prov] = { activities: 0, attendees: 0, male: 0, female: 0, orientations: 0, promotions: 0 };
    }
    map[prov].activities += 1;
    map[prov].attendees += (act.totalAttendees || 0);
    map[prov].male += (act.maleAttendees || 0);
    map[prov].female += (act.femaleAttendees || 0);
    if (act.typeOfActivity?.includes("Orientation")) {
      map[prov].orientations += 1;
    }
    if (act.typeOfActivity?.includes("Promotional")) {
      map[prov].promotions += 1;
    }
  }

  return Object.entries(map).map(([province, stats]) => ({
    province,
    ...stats,
  }));
}

export function getEgovphActivityTypeDistribution(activities: EgovphActivity[] = EGOVPH_ACTIVITIES_DATA) {
  const counts: Record<string, number> = {};
  for (const act of activities) {
    const t = act.typeOfActivity || "Other";
    counts[t] = (counts[t] || 0) + 1;
  }
  const colors: Record<string, string> = {
    "Orientation": "#3B82F6",
    "Promotional Activity": "#10B981",
    "Orientation with Promotional Activity": "#8B5CF6",
    "Other": "#64748B"
  };
  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: colors[name] || "#3B82F6"
  }));
}

export function getEgovphMonthlyTrajectory(activities: EgovphActivity[] = EGOVPH_ACTIVITIES_DATA) {
  const monthOrder = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  const monthlyStats: Record<string, { activities: number; attendees: number }> = {};
  
  for (const m of monthOrder) {
    monthlyStats[m] = { activities: 0, attendees: 0 };
  }

  for (const act of activities) {
    const m = act.month;
    if (monthlyStats[m]) {
      monthlyStats[m].activities += 1;
      monthlyStats[m].attendees += (act.totalAttendees || 0);
    }
  }

  return monthOrder
    .filter(m => monthlyStats[m].activities > 0)
    .map(month => ({
      month,
      activities: monthlyStats[month].activities,
      attendees: monthlyStats[month].attendees,
    }));
}

export function getEgovphTicketStatusDistribution(tickets: EgovphTicket[] = EGOVPH_TICKETS_DATA) {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    let s = t.status || "Unknown";
    if (s === "RESOVED") s = "RESOLVED";
    counts[s] = (counts[s] || 0) + 1;
  }
  const colors: Record<string, string> = {
    "RESOLVED": "#10B981",
    "ESCALATED": "#F59E0B",
    "Pending": "#3B82F6",
    "Duplicate Entry": "#64748B"
  };
  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: colors[name] || "#94A3B8"
  }));
}
`;

fs.writeFileSync(targetDataPath, tsCode, 'utf-8');
console.log(`Generated ${targetDataPath} successfully!`);

// Now sync into Turso DB 'egovph' table
async function syncToTurso() {
  const dbUrl = process.env.TURSO_DATABASE_URL || 'libsql://dict-monitoring-dev-ace09.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    console.warn('TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not provided, skipping DB sync.');
    return;
  }

  console.log(`Connecting to Turso DB at ${dbUrl}...`);
  const db = createClient({ url: dbUrl, authToken });

  // Check columns of egovph
  const tableInfo = await db.execute("PRAGMA table_info(egovph)");
  console.log('egovph columns:', tableInfo.rows.map(r => r.name));

  // Clear existing dummy rows if any
  await db.execute("DELETE FROM egovph");
  console.log("Cleared old egovph table records.");

  // Insert all 143 records as JSON payload matching the standard project table schema
  let inserted = 0;
  for (const act of activities) {
    const dataJson = JSON.stringify(act);
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT OR REPLACE INTO egovph (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        act.id,
        dataJson,
        act.status,
        act.province,
        act.startDate ? `${act.startDate}T00:00:00.000Z` : now,
        now
      ]
    });
    inserted++;
  }

  console.log(`Successfully synced ${inserted} records into Turso 'egovph' table!`);
}

syncToTurso().catch(err => {
  console.error("Error syncing to Turso:", err);
});
