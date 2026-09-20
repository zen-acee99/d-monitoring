export interface InternalConcern {
  category: string;
  count: number;
  description: string;
  iconName?: string;
  percentage: number;
}

export interface ExternalConcern {
  category: string;
  count: number;
  description: string;
  beneficiaries: string;
}

export interface InternalSystem {
  id: string;
  name: string;
  category: "Core MIS" | "HR & Operations" | "Connectivity & Services" | "Public Information";
  status: "Deployed" | "For Testing" | "Pending";
  description: string;
  version: string;
  userBase: string;
  lastUpdated: string;
}

export interface NetworkMilestone {
  title: string;
  status: "Completed" | "In Progress" | "Procurement";
  details: string;
  dateCompleted: string;
}

export interface BlockedCategory {
  name: string;
  description: string;
  sampleServices: string;
  policy: "Strict Block" | "Bandwidth Throttle" | "Security Drop";
}

export interface VlanConfig {
  vlanId: string;
  name: string;
  subnet: string;
  purpose: string;
  color: string;
}

export const MISS_INTERNAL_CONCERNS: InternalConcern[] = [
  { category: "Technical Support for DICT Region 5", count: 114, description: "End-user desktop, software, and workstation troubleshooting for Regional & Provincial units", percentage: 57.6 },
  { category: "Account Access / Reset Gov-mail", count: 27, description: "Official @dict.gov.ph email provisioning, password resets, and 2FA authentication recoveries", percentage: 13.6 },
  { category: "Network / Internet Issues", count: 17, description: "LAN drops, gateway failover troubleshooting, WiFi reconnectivity, and speed diagnosis", percentage: 8.6 },
  { category: "System Access Request", count: 11, description: "Role permissions and user credentials for regional internal portals and databases", percentage: 5.6 },
  { category: "Hardware and Repair", count: 7, description: "Power supply replacements, RAM upgrades, printer fixes, and peripheral diagnostics", percentage: 3.5 },
  { category: "Software Installation", count: 4, description: "OS imaging, licensed software deployment, and digital productivity tooling", percentage: 2.0 },
  { category: "Others", count: 18, description: "General ICT consultation, video conferencing setup, and facility coordination", percentage: 9.1 },
];

export const MISS_EXTERNAL_CONCERNS: ExternalConcern[] = [
  { category: "LGU - Govmail Support", count: 13, description: "Assisted Local Government Units across Bicol with government email account setups and administration", beneficiaries: "13 LGUs" },
  { category: "LGU - DNS Domain Setup", count: 7, description: "Configured and delegated gov.ph DNS records, name servers, and MX records for municipal domains", beneficiaries: "7 LGUs" },
  { category: "LGU - Web-Hosting Services", count: 4, description: "Cloud provisioning, CMS deployment, and server setup for municipal portal websites", beneficiaries: "4 LGUs" },
];

export const MISS_INTERNAL_SYSTEMS: InternalSystem[] = [
  { id: "sys-01", name: "Inventory Management System", category: "Core MIS", status: "Deployed", description: "Tracks ICT assets, spare parts, serial numbers, and equipment custody.", version: "v2.1", userBase: "DICT Regional & Provincial Units", lastUpdated: "2024-05-10" },
  { id: "sys-02", name: "Property Management System", category: "Core MIS", status: "Deployed", description: "Comprehensive property custodian slips (PAR/ICS) and asset depreciation.", version: "v1.8", userBase: "Admin & Property Custodians", lastUpdated: "2024-04-18" },
  { id: "sys-03", name: "MISS Hub System", category: "Core MIS", status: "Deployed", description: "Unified service desk, ticket logging, and IT resolution tracking portal.", version: "v2.4", userBase: "All DICT Region 5 Personnel", lastUpdated: "2024-06-01" },
  { id: "sys-04", name: "WIFI-Monitoring System", category: "Connectivity & Services", status: "Deployed", description: "Real-time ping, uptime, AP telemetry, and latency health tracker.", version: "v3.0", userBase: "Network Engineers & Support Staff", lastUpdated: "2024-06-15" },
  { id: "sys-05", name: "Travel Order Processing System", category: "HR & Operations", status: "For Testing", description: "Automated routing and digital sign-off of official regional travel orders.", version: "v1.0-RC", userBase: "Regional Executive & Field Staff", lastUpdated: "2024-06-25" },
  { id: "sys-06", name: "Document Management System", category: "HR & Operations", status: "For Testing", description: "Barcode/QR tracking for incoming, internal, and outgoing official communications.", version: "v1.2-BETA", userBase: "Records Section & Division Chiefs", lastUpdated: "2024-06-28" },
  { id: "sys-07", name: "DTR Processing System", category: "HR & Operations", status: "For Testing", description: "Biometric log parsing, official travel credit, and automated DTR generator.", version: "v2.0-TEST", userBase: "HR / Personnel Section", lastUpdated: "2024-07-02" },
  { id: "sys-08", name: "Digital Logbook System", category: "HR & Operations", status: "For Testing", description: "Visitor check-in terminal with QR badge generation and entry logs.", version: "v1.0-BETA", userBase: "Lobby Security & Front Desk", lastUpdated: "2024-06-20" },
  { id: "sys-09", name: "Official Website", category: "Public Information", status: "Pending", description: "Public-facing regional portal with news, downloadable issuances, and portals.", version: "v1.0-PLAN", userBase: "Bicol Region Citizens & Stakeholders", lastUpdated: "2024-07-10" },
];

export const MISS_NETWORK_MILESTONES: NetworkMilestone[] = [
  { title: "Reconfigured Internal Network Architecture", status: "Completed", details: "Optimized routing tables, default gateways, and inter-VLAN access control lists for DICT Region 5.", dateCompleted: "2024-03-12" },
  { title: "Network Segregation via Dedicated VLANs", status: "Completed", details: "Implemented VLAN 2600 (MISS), 2601 (LAN), and 2602 (WLAN) across all managed switches.", dateCompleted: "2024-03-28" },
  { title: "Firewall Installation & Commissioning (Forcepoint)", status: "Completed", details: "Deployed dual Forcepoint enterprise firewalls configured with High Availability (HA) failover.", dateCompleted: "2024-04-15" },
  { title: "Network Topology & Regional Infrastructure Diagram", status: "Completed", details: "Mapped end-to-end ISP uplinks (Globe, GovNet, Eastern), core switch, and distribution access points.", dateCompleted: "2024-04-20" },
  { title: "ASEAN-Aligned Whitelist & Blacklist Policy Deployment", status: "Completed", details: "Applied 1,086 blocked malicious IPs and 11 URL content filtering categories.", dateCompleted: "2024-05-02" },
  { title: "Procurement of Microsoft Office Productivity Suite", status: "Procurement", details: "Finalized technical specifications and requisitions for regional desktop licensing.", dateCompleted: "In Progress" },
];

export const MISS_BLOCKED_CATEGORIES: BlockedCategory[] = [
  { name: "Adult Content", description: "Sexually explicit websites and portals", sampleServices: "High-risk adult portals", policy: "Strict Block" },
  { name: "Adult Material", description: "Mature literature, media, and unrated imagery", sampleServices: "Explicit media servers", policy: "Strict Block" },
  { name: "Gambling", description: "Online casinos, sports betting, and e-lottery", sampleServices: "Casino & betting gateways", policy: "Strict Block" },
  { name: "Malicious Web Sites", description: "Known malware distribution and phishing lures", sampleServices: "C2 servers, drive-by download URLs", policy: "Security Drop" },
  { name: "Nudity", description: "Unregulated photo repositories and feeds", sampleServices: "Explicit photo hosts", policy: "Strict Block" },
  { name: "Sex", description: "Adult chat, dating services, and streaming", sampleServices: "Adult live streaming services", policy: "Strict Block" },
  { name: "Suspicious Content", description: "Uncategorized fast-flux domains & typo-squatted sites", sampleServices: "Dynamic DNS hosts, newly registered domains", policy: "Security Drop" },
  { name: "Legal Liability", description: "Piracy, torrent trackers, and illicit filesharing", sampleServices: "BitTorrent trackers, warez hubs", policy: "Strict Block" },
  { name: "Network Bandwidth Loss", description: "Heavy non-work streaming and high-bandwidth protocols", sampleServices: "P2P nodes, large uncompressed dumps", policy: "Bandwidth Throttle" },
  { name: "Productivity Loss", description: "Social media and consumer entertainment platforms", sampleServices: "Netflix, TikTok, Instagram, Discord", policy: "Bandwidth Throttle" },
  { name: "Security Risk", description: "Cryptojacking scripts, anonymizer proxies, VPN bypasses", sampleServices: "Tor exit relays, open proxy lists", policy: "Security Drop" },
];

export const MISS_SAMPLE_BLOCKED_IPS = [
  { ip: "101.168.43.18", risk: "Malicious Web Site / Phishing Host", country: "ASEAN / Intl", dateAdded: "2024-04-10" },
  { ip: "101.188.37.22", risk: "Suspicious Dynamic Host", country: "ASEAN / Intl", dateAdded: "2024-04-12" },
  { ip: "101.249.61.47", risk: "Malware Drop Point", country: "ASEAN / Intl", dateAdded: "2024-04-15" },
  { ip: "101.249.62.72", risk: "C2 Command Relay", country: "ASEAN / Intl", dateAdded: "2024-04-15" },
  { ip: "101.249.63.157", risk: "Exploit Scanner", country: "ASEAN / Intl", dateAdded: "2024-04-18" },
  { ip: "101.36.121.22", risk: "Illegal Gambling Node", country: "ASEAN / Intl", dateAdded: "2024-04-20" },
  { ip: "101.36.97.70", risk: "Brute Force / SSH Attack", country: "ASEAN / Intl", dateAdded: "2024-04-22" },
  { ip: "101.36.97.80", risk: "Credential Stuffing Host", country: "ASEAN / Intl", dateAdded: "2024-04-22" },
  { ip: "101.36.97.88", risk: "Phishing Redirector", country: "ASEAN / Intl", dateAdded: "2024-04-25" },
  { ip: "101.46.83.30", risk: "Cryptomining Pool", country: "ASEAN / Intl", dateAdded: "2024-04-26" },
  { ip: "101.47.98.223", risk: "Anonymizer / Open Proxy", country: "ASEAN / Intl", dateAdded: "2024-04-28" },
  { ip: "101.51.113.251", risk: "Malicious Exploit Kit", country: "ASEAN / Intl", dateAdded: "2024-05-01" },
  { ip: "101.66.161.105", risk: "Spam / Mail Relay", country: "ASEAN / Intl", dateAdded: "2024-05-03" },
  { ip: "101.71.134.165", risk: "DDoS Reflector", country: "ASEAN / Intl", dateAdded: "2024-05-04" },
  { ip: "102.130.49.150", risk: "Botnet Agent", country: "ASEAN / Intl", dateAdded: "2024-05-06" },
  { ip: "102.130.49.90", risk: "SQL Injection Probe", country: "ASEAN / Intl", dateAdded: "2024-05-08" },
  { ip: "102.212.40.100", risk: "Malicious Web Scraper", country: "ASEAN / Intl", dateAdded: "2024-05-10" },
  { ip: "102.213.6.53", risk: "Trojan Downloader", country: "ASEAN / Intl", dateAdded: "2024-05-12" },
  { ip: "102.213.6.54", risk: "Ransomware Distribution Host", country: "ASEAN / Intl", dateAdded: "2024-05-12" },
  { ip: "102.22.20.125", risk: "Unauthorized Port Scanner", country: "ASEAN / Intl", dateAdded: "2024-05-15" },
  { ip: "102.68.86.48", risk: "Fraudulent Banking Phishing", country: "ASEAN / Intl", dateAdded: "2024-05-18" },
  { ip: "102.68.86.49", risk: "Fake Gov Lure Site", country: "ASEAN / Intl", dateAdded: "2024-05-18" },
  { ip: "103.1.210.25", risk: "Suspicious Traffic Source", country: "ASEAN / Intl", dateAdded: "2024-05-20" },
  { ip: "103.100.7.141", risk: "Malware Command & Control", country: "ASEAN / Intl", dateAdded: "2024-05-22" },
  { ip: "103.112.0.20", risk: "Exploit Host", country: "ASEAN / Intl", dateAdded: "2024-05-25" },
  { ip: "103.112.0.32", risk: "Compromised DNS Resolver", country: "ASEAN / Intl", dateAdded: "2024-05-25" },
];

export const MISS_VLAN_SEGMENTATION: VlanConfig[] = [
  { vlanId: "2600", name: "MISS NETWORK", subnet: "192.168.260.0/24", purpose: "Dedicated MIS administration, server management, and network monitoring infrastructure", color: "border-blue-500 text-blue-400 bg-blue-500/10" },
  { vlanId: "2601", name: "LAN NETWORK", subnet: "192.168.261.0/24", purpose: "Regional & Provincial unit wired desktop endpoints, printers, and workstation terminals", color: "border-emerald-500 text-emerald-400 bg-emerald-500/10" },
  { vlanId: "2602", name: "WLAN NETWORK", subnet: "192.168.262.0/24", purpose: "Secure enterprise wireless access for regional personnel, official laptops, and mobile devices", color: "border-purple-500 text-purple-400 bg-purple-500/10" },
];
