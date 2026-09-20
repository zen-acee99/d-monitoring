import { PnpkiCertificate, PnpkiTrainingActivity, PnpkiSupportTicket } from "./pnpkiTypes";
import { RAW_PNPKI_TRAININGS } from "./pnpkiTrainings";
import { RAW_PNPKI_CERTIFICATES } from "./pnpkiCertificates";
import { RAW_PNPKI_TICKETS } from "./pnpkiTickets";

export * from "./pnpkiTypes";

export const PNPKI_CERTIFICATES: PnpkiCertificate[] = RAW_PNPKI_CERTIFICATES;
export const PNPKI_TRAININGS: PnpkiTrainingActivity[] = RAW_PNPKI_TRAININGS;
export const PNPKI_SUPPORT_TICKETS: PnpkiSupportTicket[] = RAW_PNPKI_TICKETS;

export interface PnpkiSummary {
  totalCertificatesProcessed: number;
  totalTrainingsConducted: number;
  totalPersonnelTrained: number;
  totalMaleParticipants: number;
  totalFemaleParticipants: number;
  totalSupportTickets: number;
  provincialCertificates: { province: string; count: number }[];
  provincialTrainings: { province: string; count: number; participants: number }[];
  concernDistribution: { name: string; count: number }[];
  categoryDistribution: { name: string; count: number }[];
  topAgencies: { agency: string; count: number }[];
  budgetDisbursedTotal: number;
}

export function getPnpkiSummary(certificates: PnpkiCertificate[] = PNPKI_CERTIFICATES): PnpkiSummary {
  const totalCertificatesProcessed = certificates.length;
  const totalTrainingsConducted = PNPKI_TRAININGS.length;

  let totalMaleParticipants = 0;
  let totalFemaleParticipants = 0;
  let totalPersonnelTrained = 0;

  PNPKI_TRAININGS.forEach((t) => {
    totalMaleParticipants += t.maleParticipants || 0;
    totalFemaleParticipants += t.femaleParticipants || 0;
    totalPersonnelTrained += t.totalParticipants || (t.maleParticipants + t.femaleParticipants) || 0;
  });

  // Provincial Certificates Breakdown
  const provCertMap: Record<string, number> = {
    Albay: 0,
    "Camarines Sur": 0,
    "Camarines Norte": 0,
    Catanduanes: 0,
    Masbate: 0,
    Sorsogon: 0,
  };

  certificates.forEach((c) => {
    const prov = c.province;
    if (provCertMap[prov] !== undefined) {
      provCertMap[prov]++;
    } else {
      provCertMap[prov] = (provCertMap[prov] || 0) + 1;
    }
  });

  const provincialCertificates = Object.entries(provCertMap).map(([province, count]) => ({
    province,
    count,
  }));

  // Provincial Trainings Breakdown
  const provTrainMap: Record<string, { count: number; participants: number }> = {
    Albay: { count: 0, participants: 0 },
    "Camarines Sur": { count: 0, participants: 0 },
    "Camarines Norte": { count: 0, participants: 0 },
    Catanduanes: { count: 0, participants: 0 },
    Masbate: { count: 0, participants: 0 },
    Sorsogon: { count: 0, participants: 0 },
  };

  PNPKI_TRAININGS.forEach((t) => {
    const p = t.province;
    if (!provTrainMap[p]) {
      provTrainMap[p] = { count: 0, participants: 0 };
    }
    provTrainMap[p].count += 1;
    provTrainMap[p].participants += t.totalParticipants;
  });

  const provincialTrainings = Object.entries(provTrainMap).map(([province, data]) => ({
    province,
    count: data.count,
    participants: data.participants,
  }));

  // Concern Distribution
  const concernMap: Record<string, number> = {};
  PNPKI_SUPPORT_TICKETS.forEach((tk) => {
    concernMap[tk.concernCategory] = (concernMap[tk.concernCategory] || 0) + 1;
  });

  const concernDistribution = Object.entries(concernMap).map(([name, count]) => ({
    name,
    count,
  }));

  // Category Distribution (NGA, LGU, SUC, etc.)
  const catMap: Record<string, number> = {};
  PNPKI_TRAININGS.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + 1;
  });

  const categoryDistribution = Object.entries(catMap).map(([name, count]) => ({
    name,
    count,
  }));

  // Top Agencies
  const agencyMap: Record<string, number> = {};
  certificates.forEach((c) => {
    agencyMap[c.agency] = (agencyMap[c.agency] || 0) + 1;
  });
  PNPKI_TRAININGS.forEach((t) => {
    agencyMap[t.partnerAgency] = (agencyMap[t.partnerAgency] || 0) + 1;
  });

  const topAgencies = Object.entries(agencyMap)
    .map(([agency, count]) => ({ agency, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCertificatesProcessed,
    totalTrainingsConducted,
    totalPersonnelTrained,
    totalMaleParticipants,
    totalFemaleParticipants,
    totalSupportTickets: PNPKI_SUPPORT_TICKETS.length,
    provincialCertificates,
    provincialTrainings,
    concernDistribution,
    categoryDistribution,
    topAgencies,
    budgetDisbursedTotal: 24400,
  };
}
