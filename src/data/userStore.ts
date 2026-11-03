import { PROJECTS } from "@/config/projects";

export type UserRole = 
  | "Super Admin"
  | "Admin"
  | "Regional Director"
  | "Asst. Regional Director"
  | "Technical Operations Division"
  | "OIC Chief - Technical Operations Division"
  | "Provincial Officer"
  | "Engr. I"
  | "Engr. II"
  | "Engr. III"
  | "PDO I"
  | "PDO II"
  | "PDO III"
  | "PLO I"
  | "PLO II"
  | "PLO III"
  | "ISA I"
  | "ISA II"
  | "ISA III"
  | "ITO I"
  | "ITO II"
  | "ADMIN I"
  | "ADMIN II"
  | "ADMIN III"
  | "ADMIN IV"
  | "ADMIN V"
  | "ACCOUNTANT I"
  | "ACCOUNTANT II"
  | "ACCOUNTANT III"
  | "ACCOUNTANT IV"
  | "ACCOUNTANT V"
  | "CLERK"
  | "DRIVER"
  | "Assistant Regional Director"
  | "Analyst"
  | "Field Engineer"
  | "Viewer"
  | string;

export interface UserRecord {
  id: string | number;
  name: string;
  email: string;
  password?: string;
  role: UserRole | string;
  region: string;
  status: "active" | "inactive";
  isFocal: boolean;
  focalProject?: string;
  pnpkiRole?: "RAO" | "RAA" | string;
  focalProvince?: string;
  phone?: string;
  access: Record<string, boolean>;
  canEdit?: boolean;
  canDelete?: boolean;
  authProvider?: "google" | "local";
  lastLogin: string;
  createdAt: string;
}

const STORAGE_KEY = "dict_r5_users_db";

const DEFAULT_USERS: UserRecord[] = [
  {
    id: "usr-mu3eob3l",
    name: "Ace Malto",
    email: "ace.malto@dict.gov.ph",
    role: "Super Admin",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Albay",
    phone: "+639556837001",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_SIGNING":true,"signing-workspace":true,"MOD_SIGNING-WORKSPACE":true,"signing":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-signing":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true},
    canEdit: true,
    canDelete: true,
    lastLogin: "Just now (GovMail SSO - 10/19/2026, 9:17:22 AM)",
    createdAt: "2026-09-16 01:12:08",
  },
  {
    id: "usr-mu72vs2b",
    name: "Rene Jane R. Buena",
    email: "renejane.buena@dict.gov.ph",
    role: "Provincial Officer",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Albay",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_URL_SHORTENER":true,"url_shortener":true,"MOD_CALENDAR":true,"calendar":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-url-shortener":true,"mod-dtr":true,"mod-calendar":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-09-18 14:53:06",
  },
  {
    id: "usr-mu73bctg",
    name: "John Peñaflor",
    email: "john.penaflor@dict.gov.ph",
    role: "Engr. II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: {"MOD_OVERVIEW":false,"overview":false,"MOD_DTR":true,"dtr":true,"MOD_URL_SHORTENER":true,"url_shortener":true,"MOD_CALENDAR":true,"calendar":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":false,"admin":false,"mod-url-shortener":false,"mod-dtr":false,"mod-calendar":false,"mod-admin":false,"mod-project-data":false,"mod-cybersecurity":false,"mod-elgu":false,"mod-freewifi":false,"mod-gecs":false,"mod-govnet":false,"mod-iidb":false,"mod-ilcdb":false,"mod-miss":false,"mod-nbp":false,"mod-pnpki":false,"mod-egovph":false,"url-shortener":true,"project-data":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-09-18 15:05:13",
  },
  {
    id: "usr-mu73hwsm",
    name: "Mr. DICT Noel Dollentas =)",
    email: "noel.dollentas@dict.gov.ph",
    role: "PLO II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Albay",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_SIGNING":true,"signing-workspace":true,"MOD_SIGNING-WORKSPACE":true,"signing":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-signing":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Just now (GovMail SSO - 10/13/2026, 7:25:03 AM)",
    createdAt: "2026-09-18 15:10:19",
  },
  {
    id: "usr-mu73jaj7",
    name: "Princess Joy Borlagdan",
    email: "princess.borlagdan@dict.gov.ph",
    role: "ISA I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Albay",
    access: {"MOD_DTR":true,"dtr":true,"MOD_SCHEDULE":false,"MOD_ADMIN":false,"MOD_CALENDAR":true,"calendar":true,"MOD_PROJECT_DATA":true,"project_data":true,"project-data":true,"MOD_ELGU":true,"elgu":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_GECS":true,"gecs":true,"MOD_IIDB":true,"iidb":true,"MOD_GOVNET":true,"govnet":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_MISS":true,"miss":true,"MOD_NBP":true,"nbp":true,"MOD_PNPKI":true,"pnpki":true,"MOD_EGOVPH":true,"egovph":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-09-18 15:11:23",
  },
  {
    id: "usr-mu7467qa",
    name: "Norly A. Tabo",
    email: "norly.tabo@dict.gov.ph",
    role: "OIC Chief - Technical Operations Division",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: true,
    focalProject: "freewifi",
    focalProvince: "TOD",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: true,
    lastLogin: "Just now (GovMail SSO - 10/7/2026, 4:21:56 PM)",
    createdAt: "2026-09-18 15:29:12",
  },
  {
    id: "usr-mu74lftk",
    name: "Ace malto",
    email: "acemm.1599@gmail.com",
    role: "Super Admin",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Albay",
    access: {"MOD_DTR":true,"dtr":true,"MOD_SCHEDULE":true,"MOD_ADMIN":true},
    canEdit: true,
    canDelete: true,
    lastLogin: "Just now (GovMail SSO - 10/29/2026, 7:54:11 PM)",
    createdAt: "2026-09-18 15:41:03",
  },
  {
    id: "usr-mudrq46b",
    name: "Ralph Dela Torre",
    email: "ralph.delatorre@dict.gov.ph",
    role: "Engr. III",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Just now (GovMail SSO - 9/23/2026, 3:21:52 PM)",
    createdAt: "2026-09-23 07:15:09",
  },
  {
    id: "usr-muxedv66",
    name: "Annabel C. Odoño-Calimpong",
    email: "annabel.calimpong@dict.gov.ph",
    role: "Regional Director",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "All Provinces / Regional",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_SIGNING":true,"signing-workspace":true,"MOD_SIGNING-WORKSPACE":true,"signing":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-signing":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-07 00:57:10",
  },
  {
    id: "usr-muxu65vx",
    name: "Jhonly Marc Seda",
    email: "jhonlymarc.seda@dict.gov.ph",
    role: "Engr. I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-07 08:19:04",
  },
  {
    id: "usr-mv4z99vf",
    name: "Michael Cantorna",
    email: "michael.cantorna@dict.gov.ph",
    role: "Provincial Officer",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProvince: "Masbate",
    access: {"MOD_OVERVIEW":true,"overview":true,"MOD_DTR":true,"dtr":true,"MOD_CALENDAR":true,"calendar":true,"MOD_SIGNING":true,"signing-workspace":true,"MOD_SIGNING-WORKSPACE":true,"signing":true,"MOD_GECS":true,"gecs":true,"MOD_FREEWIFI":true,"freewifi":true,"MOD_EGOVPH":true,"egovph":true,"MOD_ELGU":true,"elgu":true,"MOD_NBP":true,"nbp":true,"MOD_GOVNET":true,"govnet":true,"MOD_PNPKI":true,"pnpki":true,"MOD_ILCDB":true,"ilcdb":true,"MOD_CYBERSECURITY":true,"cybersecurity":true,"MOD_MISS":true,"miss":true,"MOD_IIDB":true,"iidb":true,"MOD_PROJECT_DATA":true,"project_data":true,"MOD_ADMIN":true,"admin":true,"mod-dtr":true,"mod-calendar":true,"mod-signing":true,"mod-admin":true,"mod-project-data":true,"mod-cybersecurity":true,"mod-elgu":true,"mod-freewifi":true,"mod-gecs":true,"mod-govnet":true,"mod-iidb":true,"mod-ilcdb":true,"mod-miss":true,"mod-nbp":true,"mod-pnpki":true,"mod-egovph":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Just now (GovMail SSO - 10/15/2026, 5:42:32 PM)",
    createdAt: "2026-10-12 08:15:59",
  },
  {
    id: "usr-mv63ro2r",
    name: "CANTERO, KELVIN",
    email: "kelvin.cantero@dict.gov.ph",
    role: "ISA III",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "All Provinces / Regional",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_SIGNING":true,"signing":true,"MOD_DTR":true,"dtr":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:09:50",
  },
  {
    id: "usr-mv63umuz",
    name: "TALAGTAG, RALPH SPENCER Y.",
    email: "ralph.talagtag@dict.gov.ph",
    role: "ISA II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: true,
    focalProject: "elgu",
    focalProvince: "All Provinces / Regional",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_DTR":true,"dtr":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Just now (GovMail SSO - 10/19/2026, 1:11:31 PM)",
    createdAt: "2026-10-13 03:12:07",
  },
  {
    id: "usr-mv63vyfh",
    name: "NUARIN, NIRLIND BEIN Q.",
    email: "nirlindbein.nuarin@dict.gov.ph",
    role: "PDO II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "All Provinces / Regional",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_ADMIN":false,"admin":false,"MOD_SIGNING":true,"signing":true,"MOD_DTR":true,"dtr":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:13:09",
  },
  {
    id: "usr-mv63xx8w",
    name: "CEBU, JENHEN J.",
    email: "jenhen.cebu@dict.gov.ph",
    role: "ISA I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "Masbate",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_SIGNING":true,"signing":true,"MOD_DTR":true,"dtr":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:14:41",
  },
  {
    id: "usr-mv6415pw",
    name: "DE LEON, KEN MATTHEW L.",
    email: "kenmatthew.deleon@dict.gov.ph",
    role: "ISA I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "Camarines Norte",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_DTR":true,"dtr":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:17:12",
  },
  {
    id: "usr-mv642ylm",
    name: "VILLANUEVA, KERBIE R.",
    email: "kerbie.villanueva@dict.gov.ph",
    role: "PDO I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "Catanduanes",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_SIGNING":true,"signing":true,"MOD_DTR":true,"dtr":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:18:36",
  },
  {
    id: "usr-mv646h3p",
    name: "MACHA, JOHN VINCENT B.",
    email: "johnvincent.macha@dict.gov.ph",
    role: "PDO I",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    focalProject: "elgu",
    focalProvince: "Camarines Norte",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_ELGU":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_DTR":true,"dtr":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-13 03:21:20",
  },
  {
    id: "usr-mv7onprs",
    name: "Cyryl Montales",
    email: "cyryl.montales@dict.gov.ph",
    role: "PDO II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: true,
    focalProject: "egovph",
    focalProvince: "Regional Off",
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_EGOVPH":true,"project_data":true,"MOD_PROJECT_DATA":true,"MOD_DTR":true,"dtr":true,"MOD_SIGNING":true,"signing":true},
    canEdit: true,
    canDelete: false,
    lastLogin: "Never",
    createdAt: "2026-10-14 05:42:25",
  },
  {
    id: "usr-mv8rbt6s",
    name: "James Christian",
    email: "jameschristian.manuel@dict.gov.ph",
    role: "Regional Director",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: {"gecs":true,"freewifi":true,"egovph":true,"elgu":true,"nbp":true,"govnet":true,"pnpki":true,"ilcdb":true,"cybersecurity":true,"miss":true,"iidb":true,"MOD_DTR":true,"dtr":true,"MOD_SIGNING":true,"signing":true},
    canEdit: false,
    canDelete: false,
    lastLogin: "Just now (GovMail SSO - 10/15/2026, 7:45:41 AM)",
    createdAt: "2026-10-14 23:44:54",
  },
];

export function normalizeUserAssignment(u: UserRecord): UserRecord {
  if (!u) return u;
  const lowerName = (u.name || "").toLowerCase();
  const lowerEmail = (u.email || "").toLowerCase();
  const fp = (u.focalProvince || "").trim();

  if (!fp) {
    if (lowerName.includes("rene jane") || lowerEmail.includes("renejane.buena")) {
      return { ...u, focalProvince: "Albay" };
    }
    if (lowerName.includes("antonio") && lowerName.includes("reyes")) {
      return { ...u, focalProvince: "Camarines Sur" };
    }
    if ((lowerName.includes("maria elena") && lowerName.includes("santos")) || lowerEmail.includes("maria.santos")) {
      return { ...u, focalProvince: "Camarines Norte" };
    }
    if ((lowerName.includes("carlo") && lowerName.includes("romero")) || lowerEmail.includes("carlo.romero")) {
      return { ...u, focalProvince: "Catanduanes" };
    }
    if ((lowerName.includes("ramon") && lowerName.includes("fernandez")) || lowerEmail.includes("ramon.fernandez")) {
      return { ...u, focalProvince: "Masbate" };
    }
    if ((lowerName.includes("cynthia") && lowerName.includes("morales")) || lowerEmail.includes("cynthia.morales")) {
      return { ...u, focalProvince: "Sorsogon" };
    }
    if (lowerName.includes("norly") && lowerName.includes("tabo")) {
      return { ...u, focalProvince: "TOD" };
    }
    if (lowerName.includes("calimpong") || lowerName.includes("melad")) {
      return { ...u, focalProvince: "Regional Off" };
    }
  }
  return u;
}

export function getStoredUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed
        .filter((u: any) => u && !String(u.id || "").startsWith("g-"))
        .map((u: UserRecord) => normalizeUserAssignment(u));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
    return DEFAULT_USERS;
  } catch (e) {
    console.error("Error reading users from storage:", e);
    return DEFAULT_USERS;
  }
}

export function saveStoredUsers(users: UserRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("dict_users_updated"));
  } catch (e) {
    console.error("Error saving users to storage:", e);
  }
}

/**
 * Dynamically resolves the designated DICT Focal Person for a project and optional province
 * directly from the User Directory (`administration` / `users`), strictly honoring `isFocal === true`
 * and `focalProvince` scope without falling back to unrelated provinces or hardcoded dummy names.
 */
export function resolveProjectFocalPerson(
  projectId: string,
  province?: string,
  usersList?: any[]
): string {
  const projId = String(projectId || "")
    .trim()
    .toLowerCase()
    .replace(/^mod[_-]/, "");
  if (!projId) return "Unassigned";

  const sourceUsers: any[] =
    Array.isArray(usersList) && usersList.length > 0 ? usersList : getStoredUsers();

  const isTrueFocal = (u: any): boolean => {
    if (!u || u.status === "inactive") return false;
    const focalFlag = u.isFocal === true || u.isFocal === 1 || u.isFocal === "1";
    if (!focalFlag) return false;
    const uProj = String(u.focalProject || "")
      .trim()
      .toLowerCase()
      .replace(/^mod[_-]/, "");
    return uProj === projId;
  };

  const isRegionalScope = (fProvRaw?: string): boolean => {
    const fp = String(fProvRaw || "").trim().toLowerCase();
    return (
      !fp ||
      fp === "all provinces / regional" ||
      fp === "all provinces" ||
      fp === "regional" ||
      fp === "region v (bicol)" ||
      fp === "all"
    );
  };

  const activeProjectFocals = sourceUsers.filter(isTrueFocal);
  if (activeProjectFocals.length === 0) {
    return "Unassigned";
  }

  const targetProv = String(province || "").trim().toLowerCase();
  if (targetProv && targetProv !== "all") {
    // 1. Exact province focal match
    const provMatches = activeProjectFocals.filter((u) => {
      const fp = String(u.focalProvince || "").trim().toLowerCase();
      return fp === targetProv || (fp && !isRegionalScope(fp) && fp.includes(targetProv));
    });
    if (provMatches.length > 0) {
      return Array.from(new Set(provMatches.map((u) => String(u.name).trim()))).join(" / ");
    }

    // 2. Fallback ONLY to Regional / All-Provinces focal for this project (never another specific province!)
    const regionalMatches = activeProjectFocals.filter((u) => isRegionalScope(u.focalProvince));
    if (regionalMatches.length > 0) {
      return Array.from(new Set(regionalMatches.map((u) => String(u.name).trim()))).join(" / ");
    }

    return "Unassigned";
  }

  // No specific province requested: prefer regional focal(s), otherwise list all active focals for this project
  const regionalMatches = activeProjectFocals.filter((u) => isRegionalScope(u.focalProvince));
  if (regionalMatches.length > 0) {
    return Array.from(new Set(regionalMatches.map((u) => String(u.name).trim()))).join(" / ");
  }

  return Array.from(new Set(activeProjectFocals.map((u) => String(u.name).trim()))).join(" / ");
}

