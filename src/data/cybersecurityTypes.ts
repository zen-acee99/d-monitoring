export interface CybersecurityTarget {
  id: string;
  year: number;
  programProject: string;
  plannedActivity: string;
  kpi: string;
  annualTarget: string | number;
  sem1Target?: string | number;
  sem2Target?: string | number;
  q1Accomplishment?: string | number;
  q2Accomplishment?: string | number;
  q3Accomplishment?: string | number;
  q4Accomplishment?: string | number;
  annualAccomplishment?: string | number;
  remarks?: string;
}

export interface CybersecurityEvent {
  id: string;
  no: number;
  year: number;
  dateConducted: number | string;
  formattedDate: string;
  officeInvolved: string;
  title: string;
  activityType: "Cybersecurity Awareness" | "Data Privacy Training" | "Data Privacy & Cybersecurity Awareness" | "Digital Parenting Seminar" | "Cyber Security Caravan/Events" | string;
  mode?: "Face-to-face" | "Online" | "Hybrid (F2F+Online)" | "Hybrid" | string;
  province: string;
  city?: string;
  municipality?: string;
  municipalClass?: string;
  barangay?: string;
  congressionalDistrict?: string;
  category: "High School" | "SUC" | "Elementary School" | "NGA" | "LGU" | "Senior Citizen" | "Private" | "GOCC" | "Women" | "Other Public Area" | string;
  location?: string;
  partnerInstitution?: string;
  resourceSpeaker?: string;
  aarLink?: string;
  photosLink?: string;
  budgetAllocated?: number | string;
  budgetDisbursed?: number | string;
  maleParticipants: number;
  femaleParticipants: number;
  totalParticipants: number;
  liveViewers?: number;
  fbViews?: number;
  quarter?: string;
  movRemarks?: string;
}

export function formatCyberExcelDate(serial: number | string): string {
  if (typeof serial === "string") return serial;
  if (!serial || isNaN(serial)) return "N/A";
  const utcDays = Math.floor(serial - 25569);
  const dateInfo = new Date(utcDays * 86400 * 1000);
  return dateInfo.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
