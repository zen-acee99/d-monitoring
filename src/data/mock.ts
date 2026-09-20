import { addHours, subDays } from "date-fns";

export const generateTimeSeriesData = (days = 30) => {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = subDays(now, i);
    data.push({
      date: date.toISOString().split('T')[0],
      uptime: 98 + Math.random() * 2,
      traffic: Math.floor(1000 + Math.random() * 5000),
      users: Math.floor(500 + Math.random() * 2000),
      incidents: Math.floor(Math.random() * 5),
    });
  }
  return data;
};

export const MOCK_REGIONS = [
  "NCR", "CAR", "Region I", "Region II", "Region III", "Region IV-A", "MIMAROPA", 
  "Region V", "Region VI", "Region VII", "Region VIII", "Region IX", "Region X", 
  "Region XI", "Region XII", "Caraga", "BARMM"
];

export const generateRegionalData = () => {
  return MOCK_REGIONS.map(region => ({
    region,
    operational: Math.floor(50 + Math.random() * 100),
    warning: Math.floor(Math.random() * 20),
    critical: Math.floor(Math.random() * 5),
    offline: Math.floor(Math.random() * 10),
  }));
};

export const MOCK_ALERTS = [
  { id: 1, severity: "critical", project: "Cybersecurity", message: "32 suspicious events detected", time: "5 min ago", status: "unresolved" },
  { id: 2, severity: "warning", project: "Free WiFi 4 All", message: "Bandwidth utilization above 85%", time: "12 min ago", status: "unresolved" },
  { id: 3, severity: "critical", project: "GovNet", message: "Fiber cut reported in Region VI", time: "34 min ago", status: "unresolved" },
  { id: 4, severity: "info", project: "eGOVPH", message: "Scheduled maintenance completed", time: "1 hr ago", status: "resolved" },
  { id: 5, severity: "warning", project: "Emergency Communication", message: "High latency in CAR node", time: "2 hrs ago", status: "resolved" },
];

export const MOCK_GEO_DATA = [
  { id: 1, lat: 14.5995, lng: 120.9842, status: "operational", name: "Manila Core Node", project: "GovNet" },
  { id: 2, lat: 10.3157, lng: 123.8854, status: "warning", name: "Cebu Hub", project: "Free WiFi" },
  { id: 3, lat: 7.1907, lng: 125.4553, status: "operational", name: "Davao Center", project: "eLGU" },
  { id: 4, lat: 16.4023, lng: 120.5960, status: "critical", name: "Baguio Relay", project: "Emergency Comm" },
  { id: 5, lat: 13.1391, lng: 123.7353, status: "operational", name: "Legazpi Station", project: "GovNet" },
  { id: 6, lat: 14.6760, lng: 121.0437, status: "operational", name: "QC Data Center", project: "eGOVPH" },
];
