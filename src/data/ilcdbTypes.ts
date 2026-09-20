export interface IlcdbSaroActivity {
  id: string;
  province: string;
  saroNo: string;
  activity: string;
  projectedExpenses?: number;
  actualExpenses?: number;
  status: "Completed" | "Ongoing" | "Programmed" | "Upcoming";
  division?: string;
  remarks?: string;
}

export interface IlcdbTargetAccomplishment {
  id: string;
  division: string;
  particulars: string;
  target: number;
  accomplishment: number;
  lacking: number;
  accomplishmentDetails?: string;
  remarks?: string;
  provincialBreakdown?: {
    albay?: number;
    camarinesSur?: number;
    camarinesNorte?: number;
    catanduanes?: number;
    masbate?: number;
    sorsogon?: number;
  };
  examineesBreakdown?: {
    albay: number;
    camarinesSur: number;
    camarinesNorte: number;
    catanduanes: number;
    masbate: number;
    sorsogon: number;
  };
}

export interface IlcdbTrainingSession {
  id: string;
  title: string;
  division: "TMD" | "SPARK" | "TECH4ED-DTC" | "EPMD" | "C3D2" | "CapDev";
  programType: string;
  province: string;
  scheduleDate: string;
  maleParticipants?: number;
  femaleParticipants?: number;
  totalParticipants?: number;
  pns?: number; // Prefer Not to Say / Other
  status: "Conducted" | "Ongoing" | "Upcoming";
  targetBeneficiaries: string;
  description?: string;
}
