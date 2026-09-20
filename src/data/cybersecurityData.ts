import { CybersecurityTarget, CybersecurityEvent } from "./cybersecurityTypes";
import { CYBERSECURITY_STRATEGIC_TARGETS } from "./cybersecurityTargets";
import { RAW_CYBERSECURITY_EVENTS_2024 } from "./cybersecurityEvents2024";
import { RAW_CYBERSECURITY_EVENTS_2025_2026 } from "./cybersecurityEvents2025_2026";

export * from "./cybersecurityTypes";

export const CYBERSECURITY_TARGETS: CybersecurityTarget[] = CYBERSECURITY_STRATEGIC_TARGETS;
export const CYBERSECURITY_EVENTS: CybersecurityEvent[] = [
  ...RAW_CYBERSECURITY_EVENTS_2024,
  ...RAW_CYBERSECURITY_EVENTS_2025_2026,
];

export interface CybersecuritySummary {
  totalConducts: number;
  totalParticipants: number;
  totalMaleParticipants: number;
  totalFemaleParticipants: number;
  totalFaceToFace: number;
  totalOnline: number;
  totalHybrid: number;
  totalCertPOCs: number;
  certPHResponseSLA: string;
  totalPartnerships: number;
  provincialBreakdown: { province: string; conducts: number; participants: number }[];
  categoryBreakdown: { category: string; count: number }[];
  activityTypeBreakdown: { type: string; count: number }[];
  resourceSpeakersLeaderboard: { speaker: string; conducts: number; participants: number }[];
  yearlyTrends: { year: string; conducts: number; participants: number }[];
  vulnerableGroupsTurnout: {
    women: number;
    seniorCitizens: number;
    pwd: number;
    students: number;
    pdl: number;
  };
}

export function getCybersecuritySummary(events: CybersecurityEvent[] = CYBERSECURITY_EVENTS): CybersecuritySummary {
  let totalParticipants = 0;
  let totalMaleParticipants = 0;
  let totalFemaleParticipants = 0;
  let totalFaceToFace = 0;
  let totalOnline = 0;
  let totalHybrid = 0;

  const provMap: Record<string, { conducts: number; participants: number }> = {
    Albay: { conducts: 0, participants: 0 },
    "Camarines Sur": { conducts: 0, participants: 0 },
    "Camarines Norte": { conducts: 0, participants: 0 },
    Catanduanes: { conducts: 0, participants: 0 },
    Masbate: { conducts: 0, participants: 0 },
    Sorsogon: { conducts: 0, participants: 0 },
  };

  const catMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const speakerMap: Record<string, { conducts: number; participants: number }> = {};
  const yearMap: Record<string, { conducts: number; participants: number }> = {
    "2022": { conducts: 12, participants: 7455 },
    "2023": { conducts: 14, participants: 4200 },
    "2024": { conducts: 0, participants: 0 },
    "2025": { conducts: 0, participants: 0 },
    "2026": { conducts: 0, participants: 0 },
  };

  let womenTurnout = 0;
  let seniorTurnout = 0;
  let pwdTurnout = 0;
  let studentTurnout = 0;
  let pdlTurnout = 0;

  events.forEach((e) => {
    const pCount = e.totalParticipants || (e.maleParticipants + e.femaleParticipants) || 0;
    totalParticipants += pCount;
    totalMaleParticipants += e.maleParticipants || 0;
    totalFemaleParticipants += e.femaleParticipants || 0;

    const mode = (e.mode || "Face-to-face").toLowerCase();
    if (mode.includes("online")) {
      totalOnline++;
    } else if (mode.includes("hybrid")) {
      totalHybrid++;
    } else {
      totalFaceToFace++;
    }

    // Province
    let prov = e.province || "Albay";
    if (prov.includes("Camarines Sur") || prov.includes("Baao")) prov = "Camarines Sur";
    if (provMap[prov]) {
      provMap[prov].conducts += 1;
      provMap[prov].participants += pCount;
    } else {
      provMap[prov] = { conducts: 1, participants: pCount };
    }

    // Category
    const cat = e.category || "Public Sector";
    catMap[cat] = (catMap[cat] || 0) + 1;

    // Activity Type
    const actType = e.activityType || "Cybersecurity Awareness";
    typeMap[actType] = (typeMap[actType] || 0) + 1;

    // Speakers
    const speaker = e.resourceSpeaker || "DICT Regional Officer";
    if (!speakerMap[speaker]) {
      speakerMap[speaker] = { conducts: 0, participants: 0 };
    }
    speakerMap[speaker].conducts += 1;
    speakerMap[speaker].participants += pCount;

    // Year
    const yStr = e.year ? e.year.toString() : "2024";
    if (!yearMap[yStr]) {
      yearMap[yStr] = { conducts: 0, participants: 0 };
    }
    yearMap[yStr].conducts += 1;
    yearMap[yStr].participants += pCount;

    // Vulnerable groups
    if (cat === "Women" || e.title.toLowerCase().includes("women") || e.title.toLowerCase().includes("juana")) {
      womenTurnout += pCount;
    }
    if (cat === "Senior Citizen" || e.title.toLowerCase().includes("senior")) {
      seniorTurnout += pCount;
    }
    if (e.title.toLowerCase().includes("pwd") || e.title.toLowerCase().includes("disability")) {
      pwdTurnout += pCount;
    }
    if (cat === "High School" || cat === "Elementary School" || cat === "SUC") {
      studentTurnout += pCount;
    }
    if (e.title.toLowerCase().includes("pdl") || e.title.toLowerCase().includes("bjmp")) {
      pdlTurnout += pCount;
    }
  });

  const provincialBreakdown = Object.entries(provMap).map(([province, data]) => ({
    province,
    conducts: data.conducts,
    participants: data.participants,
  }));

  const categoryBreakdown = Object.entries(catMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const activityTypeBreakdown = Object.entries(typeMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const resourceSpeakersLeaderboard = Object.entries(speakerMap)
    .map(([speaker, data]) => ({
      speaker,
      conducts: data.conducts,
      participants: data.participants,
    }))
    .sort((a, b) => b.conducts - a.conducts)
    .slice(0, 12);

  const yearlyTrends = Object.entries(yearMap).map(([year, data]) => ({
    year,
    conducts: data.conducts,
    participants: data.participants,
  }));

  return {
    totalConducts: CYBERSECURITY_EVENTS.length,
    totalParticipants,
    totalMaleParticipants,
    totalFemaleParticipants,
    totalFaceToFace,
    totalOnline,
    totalHybrid,
    totalCertPOCs: 60,
    certPHResponseSLA: "90%",
    totalPartnerships: 21,
    provincialBreakdown,
    categoryBreakdown,
    activityTypeBreakdown,
    resourceSpeakersLeaderboard,
    yearlyTrends,
    vulnerableGroupsTurnout: {
      women: womenTurnout,
      seniorCitizens: seniorTurnout,
      pwd: pwdTurnout,
      students: studentTurnout,
      pdl: pdlTurnout,
    },
  };
}
