import { IlcdbSaroActivity, IlcdbTargetAccomplishment, IlcdbTrainingSession } from "./ilcdbTypes";

export * from "./ilcdbTypes";

export const ILCDB_SARO_ACTIVITIES: IlcdbSaroActivity[] = [
  // Albay
  {
    id: "saro-alb-01",
    province: "Albay",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training",
    projectedExpenses: 68250,
    status: "Programmed",
    division: "TMD",
  },
  {
    id: "saro-alb-02",
    province: "Albay",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    projectedExpenses: 112000,
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-alb-03",
    province: "Albay",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-alb-04",
    province: "Albay",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
  {
    id: "saro-alb-05",
    province: "Albay",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },

  // Camarines Sur
  {
    id: "saro-csur-01",
    province: "Camarines Sur",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training",
    projectedExpenses: 21000,
    status: "Completed",
    division: "TMD",
    remarks: "Conducted Data Science and Analytics (85 pax)",
  },
  {
    id: "saro-csur-02",
    province: "Camarines Sur",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    projectedExpenses: 56000,
    status: "Completed",
    division: "SPARK",
    remarks: "Conducted GVA 2.0 (23 pax) & Social Media Marketing 2.0 (24 pax)",
  },
  {
    id: "saro-csur-03",
    province: "Camarines Sur",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-csur-04",
    province: "Camarines Sur",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
  {
    id: "saro-csur-05",
    province: "Camarines Sur",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },

  // Camarines Norte
  {
    id: "saro-cnor-01",
    province: "Camarines Norte",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training",
    status: "Programmed",
    division: "TMD",
  },
  {
    id: "saro-cnor-02",
    province: "Camarines Norte",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    status: "Upcoming",
    division: "SPARK",
    remarks: "PWD Segment Upcoming",
  },
  {
    id: "saro-cnor-03",
    province: "Camarines Norte",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-cnor-04",
    province: "Camarines Norte",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Completed",
    division: "TECH4ED-DTC",
    remarks: "Successfully conducted to Cam Norte on June 18, 2026",
  },
  {
    id: "saro-cnor-05",
    province: "Camarines Norte",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },

  // Catanduanes
  {
    id: "saro-cat-01",
    province: "Catanduanes",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training - 1H",
    projectedExpenses: 68000,
    status: "Completed",
    division: "TMD",
    remarks: "Conducted Python Programming (27 pax) & PHP Laravel Framework",
  },
  {
    id: "saro-cat-02",
    province: "Catanduanes",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    projectedExpenses: 112000,
    status: "Completed",
    division: "SPARK",
    remarks: "Conducted GVA 2.0 AI-Powered & Graphics Design PSD/AI",
  },
  {
    id: "saro-cat-03",
    province: "Catanduanes",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-cat-04",
    province: "Catanduanes",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
  {
    id: "saro-cat-05",
    province: "Catanduanes",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },

  // Masbate
  {
    id: "saro-mas-01",
    province: "Masbate",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training",
    projectedExpenses: 21000,
    status: "Upcoming",
    division: "TMD",
  },
  {
    id: "saro-mas-02",
    province: "Masbate",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    projectedExpenses: 112000,
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-mas-03",
    province: "Masbate",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-mas-04",
    province: "Masbate",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
  {
    id: "saro-mas-05",
    province: "Masbate",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },

  // Sorsogon
  {
    id: "saro-sor-01",
    province: "Sorsogon",
    saroNo: "2026-02-0228",
    activity: "Digital Workforce/ICT Workforce Upskilling and Reskilling Training",
    projectedExpenses: 22400,
    actualExpenses: 22400,
    status: "Completed",
    division: "TMD",
    remarks: "Conducted Digital Transformation - ICT Project Management Training (121 pax)",
  },
  {
    id: "saro-sor-02",
    province: "Sorsogon",
    saroNo: "2026-02-0244",
    activity: "SPARK ICT Technical Training (Strengthening the Philippine workforce through Adaptive and Responsive Digital Knowledge Initiative (formerly digitaljobsPH))",
    projectedExpenses: 112000,
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-sor-03",
    province: "Sorsogon",
    saroNo: "2026-05-0768",
    activity: "Conduct of Monitoring and Evaluation for Spark ICT Technical Training for FY 2026",
    status: "Programmed",
    division: "SPARK",
  },
  {
    id: "saro-sor-04",
    province: "Sorsogon",
    saroNo: "2026-05-0728",
    activity: "Conduct of 2026 Tech4ED-DTC Partner Center Manager's Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
  {
    id: "saro-sor-05",
    province: "Sorsogon",
    saroNo: "2026-05-0752",
    activity: "Conduct of 2026 Tech4ED-DTC ICT Skills Training",
    status: "Programmed",
    division: "TECH4ED-DTC",
  },
];

export const ILCDB_TARGETS_ACCOMPLISHMENTS: IlcdbTargetAccomplishment[] = [
  {
    id: "ilcdb-target-01",
    division: "EPMD",
    particulars: "2026 ICT Skills Gap Analysis Survey",
    target: 198,
    accomplishment: 821,
    lacking: 0,
    accomplishmentDetails: "Approved Summary Reports of the ICT Skills Gap Analysis 2026",
    remarks: "Ask PMT for the breakdown of the number of respondents per province (Albay, Cam Sur, Cam Norte, Catanduanes, Masbate, Sorsogon)",
    provincialBreakdown: {
      albay: 215,
      camarinesSur: 260,
      camarinesNorte: 98,
      catanduanes: 85,
      masbate: 90,
      sorsogon: 73,
    },
  },
  {
    id: "ilcdb-target-02",
    division: "C3D2",
    particulars: "Conduct of ICT Diagnostic & Proficiency Exam (June 4, 2026 & November 11, 2026)",
    target: 2,
    accomplishment: 1,
    lacking: 1,
    accomplishmentDetails: "June 4, 2026 conduct successfully executed",
    remarks: "Successfully conducted on June 4, 2026. Upcoming - November 11, 2026 Schedule",
    examineesBreakdown: {
      albay: 1,
      camarinesSur: 8,
      camarinesNorte: 1,
      catanduanes: 0,
      masbate: 4,
      sorsogon: 0,
    },
  },
  {
    id: "ilcdb-target-03",
    division: "TMD (Digital Workforce/ICT Workforce Upskilling and Reskilling)",
    particulars: "40-hours Advanced ICT Training",
    target: 2,
    accomplishment: 2,
    lacking: 0,
    accomplishmentDetails: "Python Programming Essentials (June 1-5, 2026 | M-18 F-9) & PHP Web Application Framework: Laravel (June 8-12, 2026)",
    remarks: "Catanduanes: 2 completed programs",
    provincialBreakdown: {
      catanduanes: 2,
    },
  },
  {
    id: "ilcdb-target-04",
    division: "TMD (Digital Workforce/ICT Workforce Upskilling and Reskilling)",
    particulars: "16-hours Intermediate ICT Training",
    target: 4,
    accomplishment: 6,
    lacking: -2, // Over-accomplished
    accomplishmentDetails: "Camarines Sur: Data Science and Analytics (June 23-25, 2026 | Total: 85, M: 44, F: 40, PNS: 1) | Sorsogon: Digital Transformation - ICT Project Management (June 29 - July 2, 2026 | Total: 121, M: 74, F: 48)",
    remarks: "Albay: 3, Cam Sur: 1, Masbate: 1, Sorsogon: 1. Upcoming conducts scheduled for Masbate and Sorsogon batches.",
    provincialBreakdown: {
      albay: 3,
      camarinesSur: 1,
      masbate: 1,
      sorsogon: 1,
    },
  },
  {
    id: "ilcdb-target-05",
    division: "SPARK Technical Training",
    particulars: "Unemployed, Women, Out-of-School Youth (OSY), Freelancers",
    target: 8,
    accomplishment: 6,
    lacking: 2,
    accomplishmentDetails: "Camarines Sur: General Virtual Assistance 2.0: A Paradigm Shift in AI-Powered Interaction (Feb 9 - Mar 16, 2026 | Total: 23, M: 10, F: 13) | Catanduanes: GVA 2.0 (June 8-19, 2026) & Graphics Design with PSD and AI (June 8-19, 2026)",
    remarks: "Albay: 1, Cam Sur: 1, Catanduanes: 2, Masbate: 1, Sorsogon: 1",
    provincialBreakdown: {
      albay: 1,
      camarinesSur: 1,
      catanduanes: 2,
      masbate: 1,
      sorsogon: 1,
    },
  },
  {
    id: "ilcdb-target-06",
    division: "SPARK Technical Training",
    particulars: "Person With Disability (PWD) Specialized Track",
    target: 1,
    accomplishment: 0,
    lacking: 1,
    remarks: "Upcoming cohort planned for Camarines Norte",
    provincialBreakdown: {
      camarinesNorte: 0,
    },
  },
  {
    id: "ilcdb-target-07",
    division: "SPARK Technical Training",
    particulars: "Micro, Small & Medium Enterprises (MSME) Digitization",
    target: 1,
    accomplishment: 1,
    lacking: 0,
    accomplishmentDetails: "Camarines Sur: Social Media Marketing 2.0: A Paradigm Shift in AI-Powered Interaction (June 1 to 29, 2026 | Total: 24, Male: 7, Female: 17)",
    remarks: "Camarines Sur completed",
    provincialBreakdown: {
      camarinesSur: 1,
    },
  },
  {
    id: "ilcdb-target-08",
    division: "TECH4ED-DTC SKILLS TRAINING",
    particulars: "Conduct of Tech4ED-DTC Partner Center Manager's Training",
    target: 3,
    accomplishment: 1,
    lacking: 2,
    remarks: "Successfully conducted in Camarines Norte on June 18, 2026",
    provincialBreakdown: {
      camarinesNorte: 1,
    },
  },
  {
    id: "ilcdb-target-09",
    division: "TECH4ED-DTC SKILLS TRAINING",
    particulars: "ICT Skills Training (TOT Roll out of RF, PF, CM)",
    target: 6,
    accomplishment: 4,
    lacking: 2,
    remarks: "Camarines Sur: 3 batches, Masbate: 1 batch",
    provincialBreakdown: {
      camarinesSur: 3,
      masbate: 1,
    },
  },
  {
    id: "ilcdb-target-10",
    division: "Capacity Development & Institutional Support",
    particulars: "Region/Province Initiated / Agency Requested CapDev Training",
    target: 100,
    accomplishment: 100,
    lacking: 0,
    accomplishmentDetails: "Regional CapDev operations supporting LGUs, NGAs, and academe across all 6 provinces",
    remarks: "Albay: 12, Camarines Sur: 7, Camarines Norte: 7, Catanduanes: 30, Masbate: 8, Sorsogon: 36",
    provincialBreakdown: {
      albay: 12,
      camarinesSur: 7,
      camarinesNorte: 7,
      catanduanes: 30,
      masbate: 8,
      sorsogon: 36,
    },
  },
];

export const ILCDB_TRAINING_SESSIONS: IlcdbTrainingSession[] = [
  {
    id: "sess-01",
    title: "Data Science and Analytics (16-Hours Training)",
    division: "TMD",
    programType: "ICT Workforce Upskilling & Reskilling",
    province: "Camarines Sur",
    scheduleDate: "June 23 to 25, 2026",
    totalParticipants: 85,
    maleParticipants: 44,
    femaleParticipants: 40,
    pns: 1,
    status: "Conducted",
    targetBeneficiaries: "Govt ICT Personnel, Academe & Data Practitioners",
    description: "Hands-on data cleaning, exploratory data analysis, visualization dashboards, and statistical interpretation for evidence-based decision making.",
  },
  {
    id: "sess-02",
    title: "Digital Transformation - ICT Project Management Training (16-Hours)",
    division: "TMD",
    programType: "ICT Workforce Upskilling & Reskilling",
    province: "Sorsogon",
    scheduleDate: "June 29, 2026 - July 2, 2026",
    totalParticipants: 121,
    maleParticipants: 74,
    femaleParticipants: 48,
    status: "Conducted",
    targetBeneficiaries: "LGU Project Officers, Planners, and System Admins",
    description: "Comprehensive training in Agile / Scrum methodologies, ICT resource planning, risk management, and government project procurement.",
  },
  {
    id: "sess-03",
    title: "Python Programming Essentials (40-Hours Training)",
    division: "TMD",
    programType: "ICT Workforce Upskilling & Reskilling",
    province: "Catanduanes",
    scheduleDate: "June 1-5, 2026",
    totalParticipants: 27,
    maleParticipants: 18,
    femaleParticipants: 9,
    status: "Conducted",
    targetBeneficiaries: "Programmers, Aspiring Developers & IT Instructors",
    description: "Core algorithms, data structures, scripting, OOP principles, and basic API integrations using modern Python 3 standards.",
  },
  {
    id: "sess-04",
    title: "PHP Web Application Framework: Laravel (40-Hours Training)",
    division: "TMD",
    programType: "ICT Workforce Upskilling & Reskilling",
    province: "Catanduanes",
    scheduleDate: "June 8-12, 2026",
    totalParticipants: 25,
    status: "Conducted",
    targetBeneficiaries: "Web Developers & IT Technical Staff",
    description: "MVC architecture, Eloquent ORM, authentication, routing, and RESTful API development for public sector services.",
  },
  {
    id: "sess-05",
    title: "General Virtual Assistance 2.0: A Paradigm Shift in AI-Powered Interaction",
    division: "SPARK",
    programType: "SPARK ICT Technical Training (digitaljobsPH)",
    province: "Camarines Sur",
    scheduleDate: "February 9 to March 16, 2026",
    totalParticipants: 23,
    maleParticipants: 10,
    femaleParticipants: 13,
    status: "Conducted",
    targetBeneficiaries: "Unemployed, Women, OSY, Freelancers",
    description: "Advanced GVA workflow, generative AI prompting for copywriting, automated executive scheduling, CRM tools, and international freelance client acquisition.",
  },
  {
    id: "sess-06",
    title: "Social Media Marketing 2.0: A Paradigm Shift in AI-Powered Interaction",
    division: "SPARK",
    programType: "SPARK ICT Technical Training (MSME)",
    province: "Camarines Sur",
    scheduleDate: "June 1 to 29, 2026",
    totalParticipants: 24,
    maleParticipants: 7,
    femaleParticipants: 17,
    status: "Conducted",
    targetBeneficiaries: "MSME Owners, Entrepreneurs & Marketing Coordinators",
    description: "AI-assisted content strategy, ad campaign optimization, branding, omnichannel conversion funnels, and e-commerce analytics.",
  },
  {
    id: "sess-07",
    title: "General Virtual Assistance 2.0: AI-Powered Interaction (Cohort Catanduanes)",
    division: "SPARK",
    programType: "SPARK ICT Technical Training (digitaljobsPH)",
    province: "Catanduanes",
    scheduleDate: "June 8-19, 2026",
    totalParticipants: 20,
    status: "Conducted",
    targetBeneficiaries: "Local Jobseekers, Freelancers & Home-based Workers",
    description: "Empowering island province digizens with global remote work competencies and AI productivity suites.",
  },
  {
    id: "sess-08",
    title: "Graphics Design with PSD and AI (Photoshop & Generative AI)",
    division: "SPARK",
    programType: "SPARK ICT Technical Training",
    province: "Catanduanes",
    scheduleDate: "June 8-19, 2026",
    totalParticipants: 22,
    status: "Conducted",
    targetBeneficiaries: "Creative Freelancers & Multimedia Students",
    description: "Graphic design essentials, vector styling, brand typography, and generative image synthesis for marketing collateral.",
  },
  {
    id: "sess-09",
    title: "Tech4ED-DTC Partner Center Manager's Training",
    division: "TECH4ED-DTC",
    programType: "Tech4ED & DTC Capacitation",
    province: "Camarines Norte",
    scheduleDate: "June 18, 2026",
    totalParticipants: 15,
    status: "Conducted",
    targetBeneficiaries: "Tech4ED Center Managers & LGU Community Coordinators",
    description: "Operations governance, community center sustainability, digital citizen onboarding, and rural digital hub management.",
  },
  {
    id: "sess-10",
    title: "C3D2 ICT Diagnostic & Proficiency Examination (Batch 1)",
    division: "C3D2",
    programType: "National ICT Proficiency Certification",
    province: "Regional (Cam Sur, Masbate, Albay, Cam Norte)",
    scheduleDate: "June 4, 2026",
    totalParticipants: 14,
    status: "Conducted",
    targetBeneficiaries: "Civil Service Eligible ICT Professionals & Programmers",
    description: "Hands-on diagnostic assessment and programming proficiency testing for EDPS / IT Specialist government qualifications.",
  },
  {
    id: "sess-11",
    title: "C3D2 ICT Diagnostic & Proficiency Examination (Batch 2)",
    division: "C3D2",
    programType: "National ICT Proficiency Certification",
    province: "Region V Testing Centers",
    scheduleDate: "November 11, 2026",
    status: "Upcoming",
    targetBeneficiaries: "Regional Applicants & SUC ICT Graduates",
    description: "Second cycle national competency certification for programmer eligibility.",
  },
  {
    id: "sess-12",
    title: "SPARK Technical Training for Persons With Disability (PWD)",
    division: "SPARK",
    programType: "Inclusive Digital Livelihood",
    province: "Camarines Norte",
    scheduleDate: "Upcoming Q3 2026",
    status: "Upcoming",
    targetBeneficiaries: "PWD Community Members & Advocates",
    description: "Accessible online tools, screen reader-friendly digital workflows, and inclusive freelancing pathways.",
  },
];

export interface IlcdbSummary {
  totalSaroProjectedBudget: number;
  totalSaroActualUtilized: number;
  totalSurveyRespondents: number;
  totalSurveyTarget: number;
  surveyAccomplishmentRate: number;
  totalTargetsAcrossDivisions: number;
  totalAccomplishedAcrossDivisions: number;
  overallTargetCompletionRate: number;
  totalCapDevTrainings: number;
  totalProficiencyExaminees: number;
  provincialAllocations: { province: string; projected: number; actual: number; saroCount: number }[];
  provincialCapDevDistribution: { province: string; capDevCount: number }[];
  divisionPerformance: {
    division: string;
    target: number;
    accomplishment: number;
    rate: number;
  }[];
  examineesByProvince: { province: string; count: number }[];
}

export function getIlcdbSummary(): IlcdbSummary {
  let totalProjected = 0;
  let totalActual = 0;
  const provMap: Record<string, { projected: number; actual: number; saroCount: number }> = {
    Albay: { projected: 0, actual: 0, saroCount: 0 },
    "Camarines Sur": { projected: 0, actual: 0, saroCount: 0 },
    "Camarines Norte": { projected: 0, actual: 0, saroCount: 0 },
    Catanduanes: { projected: 0, actual: 0, saroCount: 0 },
    Masbate: { projected: 0, actual: 0, saroCount: 0 },
    Sorsogon: { projected: 0, actual: 0, saroCount: 0 },
  };

  ILCDB_SARO_ACTIVITIES.forEach((s) => {
    let p = s.province;
    if (p.toLowerCase().includes("camarines sur")) p = "Camarines Sur";
    else if (p.toLowerCase().includes("camarines norte")) p = "Camarines Norte";
    else if (p.toLowerCase().includes("catanduanes")) p = "Catanduanes";
    else if (p.toLowerCase().includes("masbate")) p = "Masbate";
    else if (p.toLowerCase().includes("sorsogon")) p = "Sorsogon";
    else if (p.toLowerCase().includes("albay")) p = "Albay";

    if (!provMap[p]) {
      provMap[p] = { projected: 0, actual: 0, saroCount: 0 };
    }
    const proj = s.projectedExpenses || 0;
    const act = s.actualExpenses || 0;
    provMap[p].projected += proj;
    provMap[p].actual += act;
    provMap[p].saroCount += 1;

    totalProjected += proj;
    totalActual += act;
  });

  const provincialAllocations = Object.entries(provMap).map(([province, data]) => ({
    province,
    projected: data.projected,
    actual: data.actual,
    saroCount: data.saroCount,
  }));

  // Targets & Accomplishments aggregations
  let totalTarget = 0;
  let totalAccomplished = 0;
  const divMap: Record<string, { target: number; accomplishment: number }> = {};

  ILCDB_TARGETS_ACCOMPLISHMENTS.forEach((t) => {
    totalTarget += t.target;
    totalAccomplished += t.accomplishment;

    const divName = t.division.includes("TMD")
      ? "TMD (Upskilling)"
      : t.division.includes("SPARK")
      ? "SPARK (Digitaljobs)"
      : t.division.includes("TECH4ED")
      ? "Tech4ED & DTC"
      : t.division.includes("C3D2")
      ? "C3D2 (Proficiency)"
      : t.division.includes("EPMD")
      ? "EPMD (Survey)"
      : "CapDev Support";

    if (!divMap[divName]) {
      divMap[divName] = { target: 0, accomplishment: 0 };
    }
    divMap[divName].target += t.target;
    divMap[divName].accomplishment += t.accomplishment;
  });

  const divisionPerformance = Object.entries(divMap).map(([division, d]) => ({
    division,
    target: d.target,
    accomplishment: d.accomplishment,
    rate: Math.round((d.accomplishment / (d.target || 1)) * 100),
  }));

  // CapDev Provincial Distribution from target 10
  const capDevTarget = ILCDB_TARGETS_ACCOMPLISHMENTS.find((t) => t.id === "ilcdb-target-10");
  const provincialCapDevDistribution = [
    { province: "Albay", capDevCount: capDevTarget?.provincialBreakdown?.albay || 12 },
    { province: "Camarines Sur", capDevCount: capDevTarget?.provincialBreakdown?.camarinesSur || 7 },
    { province: "Camarines Norte", capDevCount: capDevTarget?.provincialBreakdown?.camarinesNorte || 7 },
    { province: "Catanduanes", capDevCount: capDevTarget?.provincialBreakdown?.catanduanes || 30 },
    { province: "Masbate", capDevCount: capDevTarget?.provincialBreakdown?.masbate || 8 },
    { province: "Sorsogon", capDevCount: capDevTarget?.provincialBreakdown?.sorsogon || 36 },
  ];

  // Examinees by province from C3D2 target
  const c3d2 = ILCDB_TARGETS_ACCOMPLISHMENTS.find((t) => t.id === "ilcdb-target-02");
  const examineesByProvince = [
    { province: "Camarines Sur", count: c3d2?.examineesBreakdown?.camarinesSur || 8 },
    { province: "Masbate", count: c3d2?.examineesBreakdown?.masbate || 4 },
    { province: "Albay", count: c3d2?.examineesBreakdown?.albay || 1 },
    { province: "Camarines Norte", count: c3d2?.examineesBreakdown?.camarinesNorte || 1 },
    { province: "Catanduanes", count: c3d2?.examineesBreakdown?.catanduanes || 0 },
    { province: "Sorsogon", count: c3d2?.examineesBreakdown?.sorsogon || 0 },
  ];

  const totalProficiencyExaminees = examineesByProvince.reduce((acc, curr) => acc + curr.count, 0);

  return {
    totalSaroProjectedBudget: totalProjected,
    totalSaroActualUtilized: totalActual,
    totalSurveyRespondents: 821,
    totalSurveyTarget: 198,
    surveyAccomplishmentRate: Math.round((821 / 198) * 100),
    totalTargetsAcrossDivisions: totalTarget,
    totalAccomplishedAcrossDivisions: totalAccomplished,
    overallTargetCompletionRate: Math.round((totalAccomplished / totalTarget) * 100),
    totalCapDevTrainings: 100,
    totalProficiencyExaminees,
    provincialAllocations,
    provincialCapDevDistribution,
    divisionPerformance,
    examineesByProvince,
  };
}
