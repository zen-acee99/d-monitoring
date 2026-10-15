import { ELGU_LGUS_DATA } from "./elguData";
import { EGOVPH_ACTIVITIES_DATA, EGOVPH_TICKETS_DATA, EGOVPAY_ACTIVITIES_DATA } from "./egovphData";

export interface ProjectRecordField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "badge";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
}

export interface ProjectSchema {
  id: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  iconName: string;
  statusOptions: string[];
  columns: { key: string; label: string; width?: string; isStatus?: boolean; isBadge?: boolean }[];
  fields: ProjectRecordField[];
  defaultRecords: Record<string, any>[];
}

export const PROJECT_SCHEMAS: Record<string, ProjectSchema> = {
  freewifi: {
    id: "freewifi",
    name: "Free WiFi 4 All",
    shortName: "Free WiFi",
    category: "Connectivity",
    description: "Regional public internet access points across LGUs, schools, health centers, and public plazas.",
    iconName: "Wifi",
    statusOptions: ["Active", "Degraded", "Under Maintenance", "Offline"],
    columns: [
      { key: "siteName", label: "Site Name & Facility" },
      { key: "siteType", label: "Type", isBadge: true },
      { key: "municipality", label: "Municipality / Province" },
      { key: "linkType", label: "Link Type", isBadge: true },
      { key: "apCount", label: "AP Count" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
      { key: "fundSource", label: "Fund Source" },
    ],
    fields: [
      { key: "siteName", label: "Site Name / Facility", type: "text", required: true, placeholder: "e.g., Legazpi City Hall Public Plaza" },
      { key: "siteType", label: "Facility Type", type: "select", options: ["RH (Rural Health)", "MH (Municipal Hall)", "PC (Provincial Capitol)", "PES (Public Elementary)", "PHS (Public High School)", "HEI-LUC (College/Univ)", "PP (Public Plaza)"], required: true },
      { key: "municipality", label: "Municipality", type: "text", required: true, placeholder: "e.g., Legazpi City" },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "linkType", label: "Link / Technology", type: "select", options: ["Fiber Optic", "VSAT Satellite", "Microwave / Radio", "Cellular LTE/5G"], required: true },
      { key: "apCount", label: "Active Access Points (AP)", type: "number", required: true, defaultValue: 2 },
      { key: "bandwidth", label: "Bandwidth Allocation (Mbps)", type: "number", required: true, defaultValue: 50 },
      { key: "fundSource", label: "Fund Source", type: "select", options: ["DICT Centrally Managed", "LGU Co-Funded", "Universal Service Fund (USO)", "DepEd Partnership"], required: true },
      { key: "status", label: "Operational Status", type: "select", options: ["Active", "Degraded", "Under Maintenance", "Offline"], required: true },
      { key: "installedDate", label: "Installation Date", type: "date", required: false },
      { key: "notes", label: "Operational Notes", type: "text", placeholder: "e.g., Upgraded AP firmware on recent inspection" },
    ],
    defaultRecords: []
  },

  elgu: {
    id: "elgu",
    name: "eLGU (Digital LGU Program)",
    shortName: "eLGU",
    category: "Digital Services",
    description: "Digital transformation and electronic Business Permits & Licensing System (eBPLS) for Bicol LGUs.",
    iconName: "Building2",
    statusOptions: ["Live", "Build UP", "UAT", "Inactive", "No System", "Own System"],
    columns: [
      { key: "name", label: "LGU Name & Province" },
      { key: "classification", label: "District / Class" },
      { key: "version", label: "eLGU Version", isBadge: true },
      { key: "progressPercentage", label: "Progress %" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Deployment Status", isStatus: true },
    ],
    fields: [
      { key: "name", label: "LGU Name", type: "text", required: true, placeholder: "e.g., Pandan", defaultValue: "Pandan" },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true, defaultValue: "Catanduanes" },
      { key: "classification", label: "Congressional District / Class", type: "text", required: true, placeholder: "e.g., Lone District", defaultValue: "Lone District" },
      { key: "version", label: "eLGU Version / Platform", type: "select", options: ["V2 eLGU", "V1 BPBC", "V1 BPCO", "V1 BPBC, V1 BPCO", "In-House", "None"], required: true, defaultValue: "V2 eLGU" },
      { key: "status", label: "Deployment Status", type: "select", options: ["Live", "Build UP", "UAT", "Inactive", "No System", "Own System"], required: true, defaultValue: "Live" },
      { key: "monthlyTransactions", label: "Avg. Monthly Txns", type: "number", required: false, defaultValue: 0 },
      { key: "registeredUsers", label: "Registered Citizen Users", type: "number", required: false, defaultValue: 0 },
      { key: "goLiveDate", label: "Official Go-Live Date", type: "date", required: false },
      { key: "notes", label: "Notes / Blockers", type: "text", required: false, defaultValue: "" },
    ],
    defaultRecords: ELGU_LGUS_DATA
  },

  pnpki: {
    id: "pnpki",
    name: "PNPKI (Public Key Infrastructure)",
    shortName: "PNPKI",
    category: "Security",
    description: "Digital certificates, electronic signatures, and secure identity validation for government personnel and citizens.",
    iconName: "ShieldCheck",
    statusOptions: ["Active", "Expiring Soon", "Revoked", "Pending Approval"],
    columns: [
      { key: "applicantName", label: "Subscriber / Applicant" },
      { key: "agencyName", label: "Agency / LGU Office" },
      { key: "certType", label: "Certificate Type", isBadge: true },
      { key: "validityYears", label: "Validity" },
      { key: "issuedDate", label: "Issued Date" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "applicantName", label: "Subscriber / Personnel Name", type: "text", required: true, placeholder: "e.g., Maria Teresa Santos" },
      { key: "agencyName", label: "Government Agency / LGU", type: "text", required: true, placeholder: "e.g., DepEd Region V - SDO Albay" },
      { key: "email", label: "Official Government Email", type: "text", required: true, placeholder: "e.g., maria.santos@deped.gov.ph" },
      { key: "certType", label: "Certificate Type", type: "select", options: ["Individual (Gov't Employee)", "Digital Signature (Focal/Signatory)", "Server SSL / TLS", "Document Signing Token"], required: true },
      { key: "province", label: "Province / Station", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "validityYears", label: "Validity Duration", type: "select", options: ["1 Year", "2 Years", "3 Years"], required: true },
      { key: "issuedDate", label: "Date of Issuance", type: "date", required: true },
      { key: "status", label: "Certificate Status", type: "select", options: ["Active", "Expiring Soon", "Revoked", "Pending Approval"], required: true },
      { key: "serialNumber", label: "Token Serial Number / Ref ID", type: "text", placeholder: "e.g., PNPKI-R5-2024-88421" },
    ],
    defaultRecords: []
  },

  cybersecurity: {
    id: "cybersecurity",
    name: "Cybersecurity & Threat Response",
    shortName: "Cybersecurity",
    category: "Security",
    description: "Regional CSIRT security incident tracking, vulnerability scans, threat detection, and LGU security audits.",
    iconName: "ShieldAlert",
    statusOptions: ["Resolved", "Investigating", "Mitigated", "Monitoring"],
    columns: [
      { key: "incidentTitle", label: "Incident / Target Asset" },
      { key: "threatCategory", label: "Threat Category", isBadge: true },
      { key: "affectedEntity", label: "Affected Agency / LGU" },
      { key: "severity", label: "Severity Level", isBadge: true },
      { key: "dateLogged", label: "Date Detected" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "incidentTitle", label: "Incident Title / Asset Name", type: "text", required: true, placeholder: "e.g., LGU Portal SQL Injection Attempt" },
      { key: "threatCategory", label: "Threat Classification", type: "select", options: ["Phishing Campaign", "Web Defacement", "Ransomware / Malware", "DDoS Attack", "SQL Injection / Exploit", "Unauthorized Access Attempt", "Data Leak / Exposure"], required: true },
      { key: "affectedEntity", label: "Affected Government Entity", type: "text", required: true, placeholder: "e.g., Province of Sorsogon Web Host" },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon", "Regional Scope"], required: true },
      { key: "severity", label: "Severity Level", type: "select", options: ["Critical", "High", "Medium", "Low"], required: true },
      { key: "status", label: "Investigation / Mitigation Status", type: "select", options: ["Resolved", "Investigating", "Mitigated", "Monitoring"], required: true },
      { key: "dateLogged", label: "Date Detected", type: "date", required: true },
      { key: "handler", label: "CSIRT Lead Investigator", type: "text", placeholder: "e.g., CERT-R5 Cyber Ops Unit" },
      { key: "resolutionNotes", label: "Action Taken / Remediation", type: "text", placeholder: "e.g., IP blocked, WAF rule deployed, patched CMS vulnerabilities" },
    ],
    defaultRecords: []
  },

  ilcdb: {
    id: "ilcdb",
    name: "ILCDB (ICT Literacy & Skills)",
    shortName: "ILCDB",
    category: "Education",
    description: "ICT capability training programs, digital skills development, civil servant webinars, and cybersecurity academies.",
    iconName: "GraduationCap",
    statusOptions: ["Completed", "Ongoing", "Scheduled", "Registration Open"],
    columns: [
      { key: "courseTitle", label: "Course / Training Program" },
      { key: "track", label: "Track / Specialty", isBadge: true },
      { key: "modality", label: "Modality" },
      { key: "targetAudience", label: "Target Audience" },
      { key: "enrolledCount", label: "Graduates / Enrolled" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "courseTitle", label: "Course / Webinar Title", type: "text", required: true, placeholder: "e.g., Python Programming & Data Analytics Fundamentals" },
      { key: "track", label: "Curriculum Track", type: "select", options: ["Software & Web Development", "Cybersecurity & Data Privacy", "Digital Governance & eLGU", "AI & Emerging Technologies", "Basic ICT Literacy for MSMEs"], required: true },
      { key: "modality", label: "Delivery Modality", type: "select", options: ["Online Webinar (Zoom/Meet)", "In-Person Classroom", "Blended / Hybrid"], required: true },
      { key: "targetAudience", label: "Target Participants", type: "text", required: true, placeholder: "e.g., LGU IT Staff, State College Students, MSMEs" },
      { key: "province", label: "Host Location / Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon", "Region-wide"], required: true },
      { key: "enrolledCount", label: "Total Completed / Enrolled", type: "number", required: true, defaultValue: 45 },
      { key: "targetQuota", label: "Target Participant Quota", type: "number", required: true, defaultValue: 50 },
      { key: "startDate", label: "Start Date", type: "date", required: true },
      { key: "endDate", label: "End Date", type: "date", required: false },
      { key: "instructor", label: "Instructor / Trainer", type: "text", placeholder: "e.g., DICT Certified Master Trainer" },
      { key: "status", label: "Course Status", type: "select", options: ["Completed", "Ongoing", "Scheduled", "Registration Open"], required: true },
    ],
    defaultRecords: []
  },

  gecs: {
    id: "gecs",
    name: "GECS (Emergency Communications)",
    shortName: "GECS",
    category: "Infrastructure",
    description: "Emergency satellite response units, VHF/UHF repeaters, and disaster resilience hubs for rapid disaster deployment.",
    iconName: "Radio",
    statusOptions: ["Operational", "Standby", "Deployed", "Maintenance"],
    columns: [
      { key: "hubName", label: "Asset / Hub Name" },
      { key: "equipmentType", label: "Equipment Class", isBadge: true },
      { key: "location", label: "Station Base / Province" },
      { key: "frequencyBand", label: "Band / Connectivity" },
      { key: "readinessScore", label: "Readiness %" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Operational Status", isStatus: true },
    ],
    fields: [
      { key: "hubName", label: "Hub / Node Designation", type: "text", required: true, placeholder: "e.g., GECS Rapid Satellite Hub Legazpi" },
      { key: "equipmentType", label: "Equipment Classification", type: "select", options: ["Satellite Emergency Terminal (VSAT)", "VHF/UHF Repeater Station", "Mobile Command Vehicle (MCoV)", "HF Tactical Radio Kit", "Starlink Emergency Flyaway Kit"], required: true },
      { key: "location", label: "Base Station / Location", type: "text", required: true, placeholder: "e.g., DICT Regional Disaster Center, Rawis" },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "frequencyBand", label: "Frequency / Connectivity", type: "text", required: true, placeholder: "e.g., Ku-Band / 144.550 MHz Repeater" },
      { key: "readinessScore", label: "Readiness Score (%)", type: "number", required: true, defaultValue: 100 },
      { key: "focalOfficer", label: "Responsible Disaster Officer", type: "text", placeholder: "e.g., GECS Bicol Quick Response Team" },
      { key: "lastDrillDate", label: "Last Test / Drill Date", type: "date" },
      { key: "status", label: "Deployment Status", type: "select", options: ["Operational", "Standby", "Deployed", "Maintenance"], required: true },
    ],
    defaultRecords: []
  },

  govnet: {
    id: "govnet",
    name: "GovNet & NBP (Fiber Infrastructure)",
    shortName: "GovNet",
    category: "Infrastructure",
    description: "High-speed government fiber network interconnecting regional agency offices, state universities, and hospitals.",
    iconName: "Server",
    statusOptions: ["Operational", "Degraded", "Fiber Cut / Alert", "Under Maintenance"],
    columns: [
      { key: "nodeName", label: "Agency / Fiber Node" },
      { key: "nodeType", label: "Facility Class", isBadge: true },
      { key: "municipality", label: "Location / Province" },
      { key: "portSpeed", label: "Port Capacity" },
      { key: "uptimePercent", label: "Uptime %" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "nodeName", label: "Connected Agency / Node Name", type: "text", required: true, placeholder: "e.g., Regional Government Center Bldg 2 (NEDA/DILG)" },
      { key: "nodeType", label: "Facility Classification", type: "select", options: ["Regional Government Center", "Provincial Capitol POP", "State University Backbone", "Regional Hospital Hub", "LGU Gateway Node"], required: true },
      { key: "municipality", label: "City / Municipality", type: "text", required: true, placeholder: "e.g., Legazpi City" },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "portSpeed", label: "Port Capacity / Bandwidth", type: "select", options: ["1 Gbps Dedicated Fiber", "10 Gbps Core Backbone", "500 Mbps Metro Link", "100 Mbps Access"], required: true },
      { key: "uptimePercent", label: "Current SLA Uptime (%)", type: "number", required: true, defaultValue: 99.9 },
      { key: "fiberLengthKm", label: "Fiber Route Distance (km)", type: "number", defaultValue: 4.5 },
      { key: "status", label: "Network Link Status", type: "select", options: ["Operational", "Degraded", "Fiber Cut / Alert", "Under Maintenance"], required: true },
    ],
    defaultRecords: []
  },

  egovph: {
    id: "egovph",
    name: "eGOVPH (Super App & Digital Services)",
    shortName: "eGOVPH",
    category: "Digital Services",
    description: "eGovPH Super App promotion, citizen orientations, eGovPay LGU onboarding, and citizen technical assistance ticketing.",
    iconName: "Globe",
    statusOptions: ["Completed", "Ongoing", "Scheduled"],
    columns: [
      { key: "activityTitle", label: "Activity Title / Description" },
      { key: "province", label: "Province", isBadge: true },
      { key: "municipality", label: "LGU / Municipality" },
      { key: "typeOfActivity", label: "Activity Type", isBadge: true },
      { key: "totalAttendees", label: "Attendees" },
      { key: "dictPersonnel", label: "DICT Personnel Involve" },
      { key: "startDate", label: "Date" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "activityTitle", label: "Activity Title", type: "text", required: true, placeholder: "e.g., eGovPH App Orientation for Students & LGU" },
      { key: "typeOfActivity", label: "Type of Activity", type: "select", options: ["Orientation", "Promotional Activity", "Orientation with Promotional Activity"], required: true },
      { key: "province", label: "Province", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "municipality", label: "LGU / Municipality / City", type: "text", required: true, placeholder: "e.g., City of Legazpi, Albay" },
      { key: "venue", label: "Venue", type: "text", placeholder: "e.g., DTC Regional Office 5 / SB Session Hall" },
      { key: "partnerName", label: "Name of Partner (LGU / NGA / SUC / Private)", type: "text", placeholder: "e.g., LGU Barcelona / DepEd / SSU" },
      { key: "startDate", label: "Start Date", type: "date", required: true },
      { key: "endDate", label: "End Date", type: "date" },
      { key: "totalAttendees", label: "Total Attendees", type: "number", required: true, defaultValue: 0 },
      { key: "maleAttendees", label: "Male Attendees", type: "number", defaultValue: 0 },
      { key: "femaleAttendees", label: "Female Attendees", type: "number", defaultValue: 0 },
      { key: "dictPersonnel", label: "DICT Personnel Involved", type: "text", placeholder: "e.g., Cyryl L. Montales, Princess Joy Borlagdan" },
      { key: "status", label: "Activity Status", type: "select", options: ["Completed", "Ongoing", "Scheduled"], required: true },
      { key: "afterActivityReport", label: "After-Activity Report (AAR) Filename", type: "text", placeholder: "e.g., AAR_eGovPH_Orientation.pdf" },
      { key: "todaInput", label: "TODA Input / Drive Link", type: "text", placeholder: "https://drive.google.com/..." },
      { key: "fbPostingUrl", label: "FB Posting Link", type: "text", placeholder: "https://www.facebook.com/share/..." },
      { key: "remarks", label: "Remarks / Notes", type: "text" },
    ],
    defaultRecords: EGOVPH_ACTIVITIES_DATA as any
  },

  egovph_tickets: {
    id: "egovph_tickets",
    name: "eGOVPH Citizen Support & Tickets",
    shortName: "eGov Tickets",
    category: "Digital Services",
    description: "Citizen technical assistance, Digital ID issues, eGSISMO, PCN/TRN troubleshooting, and Central Office escalation tracking.",
    iconName: "LifeBuoy",
    statusOptions: ["RESOLVED", "ESCALATED", "Pending", "Duplicate Entry"],
    columns: [
      { key: "ticketNo", label: "Ticket No" },
      { key: "clientName", label: "Citizen / Client Name" },
      { key: "issueDescription", label: "Issue / Request Concern" },
      { key: "modeOfAssistance", label: "Mode" },
      { key: "assistedBy", label: "Assisted By" },
      { key: "timestamp", label: "Date / Time" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "ticketNo", label: "Ticket Number (e.g. R5-001)", type: "text", required: true, placeholder: "e.g., R5-087" },
      { key: "clientName", label: "Client Full Name", type: "text", required: true, placeholder: "e.g., Juan Dela Cruz" },
      { key: "email", label: "Client Email Address", type: "text", placeholder: "e.g., juan.delacruz@gmail.com" },
      { key: "contactNo", label: "Contact Number", type: "text", placeholder: "e.g., 09171234567" },
      { key: "kindOfRequest", label: "Kind of Request", type: "text", placeholder: "e.g., Non-appearance of Digital ID, eGovPay concern" },
      { key: "pcnTrn", label: "PCN or TRN", type: "text", placeholder: "e.g., 1234-5678-9012-3456" },
      { key: "issueDescription", label: "Issue Concern / Details", type: "text", required: true },
      { key: "modeOfAssistance", label: "Mode of Assistance", type: "select", options: ["Assisted in person", "Assisted Online / Social Media", "Assisted through Phone Call / Text", "Assisted through Email"], required: true },
      { key: "status", label: "Action Taken / Status", type: "select", options: ["RESOLVED", "ESCALATED", "Pending", "Duplicate Entry"], required: true },
      { key: "assistedBy", label: "Assisted By (DICT Personnel)", type: "text", placeholder: "e.g., Cyryl L. Montales" },
      { key: "coTicketNo", label: "Central Office (CO) Ticket No", type: "text" },
      { key: "remarks", label: "Remarks / Resolution Notes", type: "text" },
    ],
    defaultRecords: EGOVPH_TICKETS_DATA as any
  },

  egovpay: {
    id: "egovpay",
    name: "eGovPay (LGU Onboarding & UAT)",
    shortName: "eGovPay",
    category: "Digital Services",
    description: "eGovPay merchant payment onboarding, User Acceptance Testing (UAT V1/V2), and LGU municipal finance integration.",
    iconName: "CreditCard",
    statusOptions: ["Completed", "Ongoing", "Scheduled"],
    columns: [
      { key: "lguName", label: "LGU / Municipality" },
      { key: "activityName", label: "Activity / UAT Stage", isBadge: true },
      { key: "venue", label: "Venue / Mode" },
      { key: "totalAttendees", label: "Attendees" },
      { key: "dictPersonnel", label: "DICT Personnel Involved" },
      { key: "startDate", label: "Date" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "lguName", label: "LGU Name / Municipality", type: "text", required: true, placeholder: "e.g., Barcelona, Sorsogon" },
      { key: "activityName", label: "Activity / Stage", type: "select", options: ["eGovPay UAT V1", "eGovPay UAT V2", "eGovPay Onboarding"], required: true },
      { key: "venue", label: "Venue / Mode", type: "text", placeholder: "e.g., SB Session Hall / Gmeet" },
      { key: "startDate", label: "Start Date", type: "date", required: true },
      { key: "endDate", label: "End Date", type: "date" },
      { key: "maleAttendees", label: "Male Attendees", type: "number", defaultValue: 0 },
      { key: "femaleAttendees", label: "Female Attendees", type: "number", defaultValue: 0 },
      { key: "totalAttendees", label: "Total Attendees", type: "number", defaultValue: 0 },
      { key: "dictPersonnel", label: "DICT Personnel Involved", type: "text", placeholder: "e.g., Princess Joy Borlagdan, Ace Malto" },
      { key: "status", label: "Status", type: "select", options: ["Completed", "Ongoing", "Scheduled"], required: true },
      { key: "afterActivityReport", label: "After-Activity Report (AAR)", type: "text" },
      { key: "fbPostingUrl", label: "FB Posting Link", type: "text" },
    ],
    defaultRecords: EGOVPAY_ACTIVITIES_DATA as any
  },

  miss: {
    id: "miss",
    name: "Managed ICT Support Services (MISS)",
    shortName: "MISS",
    category: "Services & Systems",
    description: "Regional IT helpdesk, internal enterprise applications, Forcepoint firewall security, and LGU technical services for DICT Region 5.",
    iconName: "Server",
    statusOptions: ["Deployed", "For Testing", "Pending", "Under Maintenance"],
    columns: [
      { key: "systemName", label: "System / Service Module" },
      { key: "category", label: "Category", isBadge: true },
      { key: "version", label: "Version" },
      { key: "userBase", label: "Target Userbase" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Deployment Status", isStatus: true },
      { key: "lastUpdated", label: "Last Updated" },
    ],
    fields: [
      { key: "systemName", label: "System Name", type: "text", required: true, placeholder: "e.g., Inventory Management System" },
      { key: "category", label: "System Category", type: "select", options: ["Core MIS", "HR & Operations", "Connectivity & Services", "Public Information"], required: true },
      { key: "version", label: "Software Version", type: "text", required: true, defaultValue: "v1.0" },
      { key: "status", label: "Deployment Status", type: "select", options: ["Deployed", "For Testing", "Pending", "Under Maintenance"], required: true },
      { key: "userBase", label: "Target Userbase", type: "text", required: true, placeholder: "e.g., All DICT Region 5 Personnel" },
      { key: "description", label: "System Scope & Purpose", type: "text", placeholder: "e.g., Tracks IT assets, serial numbers, and equipment custody" },
      { key: "lastUpdated", label: "Last Update Date", type: "date", required: false },
    ],
    defaultRecords: []
  },

  nbp: {
    id: "nbp",
    name: "National Broadband Plan (NBP)",
    shortName: "NBP",
    category: "Infrastructure",
    description: "Regional point-of-presence (POP) fiber routes, backbone expansion, tower collocation, and high-capacity carrier interconnects across Region V.",
    iconName: "Server",
    statusOptions: ["Operational", "Under Expansion", "Degraded", "Scheduled Maintenance"],
    columns: [
      { key: "popName", label: "POP / Backbone Segment" },
      { key: "infrastructureType", label: "Infrastructure Type", isBadge: true },
      { key: "province", label: "Province" },
      { key: "capacityGbps", label: "Capacity (Gbps)" },
      { key: "connectedAgenciesCount", label: "Connected Nodes" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "popName", label: "POP / Route Designation", type: "text", required: true, placeholder: "e.g., NBP Legazpi Core Gateway POP" },
      { key: "infrastructureType", label: "Infrastructure Class", type: "select", options: ["Fiber Optic Backbone (FOB)", "Bypass Route", "Tower Collocation POP", "Microwave Hub", "Submarine Landing Link"], required: true },
      { key: "province", label: "Province Station", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon"], required: true },
      { key: "capacityGbps", label: "Backbone Capacity (Gbps)", type: "number", required: true, defaultValue: 100 },
      { key: "routeDistanceKm", label: "Segment Distance (km)", type: "number", defaultValue: 45.0 },
      { key: "connectedAgenciesCount", label: "Active Agency Drops", type: "number", required: true, defaultValue: 18 },
      { key: "uptimePercent", label: "SLA Uptime (%)", type: "number", defaultValue: 99.98 },
      { key: "dictLead", label: "Assigned NBP Lead Engineer", type: "text", placeholder: "e.g., Engr. Ronald Gomez / TOD NBP Unit" },
      { key: "status", label: "Operational Status", type: "select", options: ["Operational", "Under Expansion", "Degraded", "Scheduled Maintenance"], required: true },
    ],
    defaultRecords: []
  },

  iidb: {
    id: "iidb",
    name: "ICT Industry Development Bureau (IIDB)",
    shortName: "IIDB",
    category: "Industry Development",
    description: "Digital startups, digital careers for freelancers, MSME e-commerce onboarding, and regional IT-BPM talent ecosystem programs.",
    iconName: "FolderKanban",
    statusOptions: ["Active", "Ongoing", "Completed", "Planning Phase"],
    columns: [
      { key: "initiativeName", label: "Initiative / Program Track" },
      { key: "programPillar", label: "Pillar", isBadge: true },
      { key: "province", label: "Province Scope" },
      { key: "targetBeneficiaries", label: "Beneficiaries" },
      { key: "partnerHCI", label: "Partner Entity / HEI" },
      { key: "dictFocal", label: "DICT Focal Person" },
      { key: "status", label: "Status", isStatus: true },
    ],
    fields: [
      { key: "initiativeName", label: "Initiative / Workshop Title", type: "text", required: true, placeholder: "e.g., digitalcareers - Bicol Virtual Freelancers Bootcamp" },
      { key: "programPillar", label: "IIDB Pillar", type: "select", options: ["Digital Careers", "Digital Startups & Innovation", "MSME E-Commerce Onboarding", "IT-BPM Talent Development", "Rural Impact Sourcing"], required: true },
      { key: "province", label: "Province Target", type: "select", options: ["Albay", "Camarines Sur", "Camarines Norte", "Catanduanes", "Masbate", "Sorsogon", "Region-wide"], required: true },
      { key: "targetBeneficiaries", label: "Target Beneficiary Count", type: "number", required: true, defaultValue: 100 },
      { key: "partnerHCI", label: "Partner Entity / University / LGU", type: "text", required: true, placeholder: "e.g., Bicol University & DTI Region V" },
      { key: "budgetAllocated", label: "Allocated Budget (PHP)", type: "number", defaultValue: 250000 },
      { key: "startDate", label: "Start Date", type: "date", required: true },
      { key: "status", label: "Program Status", type: "select", options: ["Active", "Ongoing", "Completed", "Planning Phase"], required: true },
    ],
    defaultRecords: []
  }
};
