export interface PnpkiCertificate {
  id: string;
  fullName: string;
  username?: string;
  email: string;
  mobileNumber?: string;
  address?: string;
  serialNumber: string;
  agency: string;
  taxId?: string;
  rao: string;
  status: "PROCESSED" | "REGISTERED" | "ISSUED" | "EXPIRED";
  province: string;
  gender?: string;
  congressionalDistrict?: string;
}

export interface PnpkiTrainingActivity {
  id: string;
  no: number;
  province: string;
  dateStarted: number;
  dateCompleted: number;
  formattedDate: string;
  title: string;
  activityType: string;
  partnerAgency: string;
  municipality?: string;
  municipalClass?: string;
  barangay?: string;
  congressionalDistrict?: string;
  category: "SUC" | "LGU" | "NGA" | "GOCCs" | "Private" | string;
  budgetUtilized?: string | number;
  budgetDisbursed?: string | number;
  maleParticipants: number;
  femaleParticipants: number;
  totalParticipants: number;
  mode: "On-site" | "Online" | "Hybrid" | string;
  aarLink?: string;
  aarStatus?: string;
  photosLink?: string;
}

export interface PnpkiSupportTicket {
  id: string;
  subscriber: string;
  agency?: string;
  province: string;
  concern: string;
  concernCategory: "Installation & Setup" | "Password & Account Reset" | "Revocation & Renewal" | "eKYC & ORS Issues" | "Digital Signing & Software";
  status: "RESOLVED" | "CLOSED" | "IN_PROGRESS";
  dateReported?: string;
}

export function formatExcelDate(serial: number): string {
  if (!serial || isNaN(serial)) return "N/A";
  // Excel epoch: Dec 30, 1899
  const utcDays = Math.floor(serial - 25569);
  const dateInfo = new Date(utcDays * 86400 * 1000);
  return dateInfo.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
