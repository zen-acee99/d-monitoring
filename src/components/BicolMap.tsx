import React, { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  X, ExternalLink, MapPin, Search, Layers, Navigation, CheckCircle2,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { 
  getAllMunicipalityPins, 
  KEY_REGIONAL_CITIES, 
  PROVINCE_CENTERS, 
  MUNICIPALITY_COORDINATES,
  MunicipalityPin 
} from "@/data/bicolMapData";
import { projectApi, MapSite } from "@/services/api";

// Animated map controller for zooming/panning to selected coordinates
function MapFlyController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.1,
      easeLinearity: 0.25,
    });
  }, [center, zoom, map]);
  return null;
}

// Complete dictionary of exact GPS coordinates for Bicol regional landmarks, schools, and hubs
const KNOWN_COORDINATES: Record<string, [number, number]> = {
  // ==========================================
  // 1. ALBAY - LEGAZPI & HUBS
  // ==========================================
  "dict regional office v": [13.1415, 123.7485],
  "dict r5 operations center": [13.1610, 123.7505],
  "albay provincial capitol": [13.1408, 123.7383],
  "legazpi city hall": [13.1396, 123.7394],
  "regional government center hub (rawis)": [13.1608, 123.7510],
  "dilg regional office 5": [13.1605, 123.7512],
  "philhealth regional office 5": [13.1520, 123.7460],
  "bicol regional hospital & medical center (brhmc)": [13.1534, 123.7432],
  "bicol university main campus core pop": [13.1444, 123.7297],
  "nbp legazpi regional core node": [13.1418, 123.7480],
  "camp ola": [13.1485, 123.7350],
  "legazpi city convention center": [13.1450, 123.7440],
  "ust legazpi": [13.1472, 123.7481],
  "embarcadero": [13.1410, 123.7530],
  "bagumbayan eash washington national high school": [13.1412, 123.7418],
  "bagumbayan elementary school": [13.1420, 123.7420],
  "banquerohan high school": [13.1050, 123.7350],
  "bigaa elementary school": [13.1590, 123.7630],
  "legazpi city science high school": [13.1475, 123.7405],
  "bitano elementary school": [13.1470, 123.7410],
  "albay central school": [13.1405, 123.7375],
  "bonga elementary school": [13.1890, 123.7380],
  "buraguis elementary school": [13.1460, 123.7250],
  "buyoan national high school": [13.1950, 123.7650],
  "cabangan high school": [13.1495, 123.7315],
  "cabangan elementary school": [13.1490, 123.7310],
  "dita elementary school": [13.1750, 123.7150],
  "mariawa elementary school": [13.1250, 123.7050],
  "mabinit elementary school": [13.1850, 123.7180],
  "maslog high school": [13.1120, 123.7600],
  "oro site high school": [13.1445, 123.7345],
  "ibalon elementary school": [13.1440, 123.7340],
  "san joaquin elementary school": [13.1710, 123.7680],
  "puro elementary school": [13.1310, 123.7630],
  "legazpi city national high school": [13.1620, 123.7495],
  "rawis elementary school": [13.1615, 123.7490],
  "tamaoyan elementary school": [13.1680, 123.7120],
  "taysan integrated school": [13.1180, 123.7180],
  "taysan elementary school": [13.1170, 123.7190],
  "pawa high school": [13.1750, 123.7430],

  // ==========================================
  // 2. CAMARINES NORTE - DAET & MUNICIPALITIES
  // ==========================================
  "daet municipal hall": [14.1132, 122.9556],
  "lgu daet": [14.1132, 122.9556],
  "camarines norte provincial capitol": [14.1147, 122.9547],
  "little theater": [14.1147, 122.9547],
  "microsystems college foundation": [14.1105, 122.9575],
  "moreno integrated school": [14.1202, 122.9460],
  "nbp daet": [14.1145, 122.9535],
  "dict camarines norte": [14.1148, 122.9542],
  "camarines norte pnpki": [14.1148, 122.9542],
  "tech4ed-dtc camarines norte": [14.1149, 122.9545],
  
  // Capalonga
  "capalonga municipal hall": [14.3338, 122.5003],
  "lgu capalonga": [14.3338, 122.5003],
  "gonzalo aler national high school": [14.3355, 122.5020],

  // Basud
  "basud municipal hall": [14.0665, 122.9660],
  "lgu basud": [14.0665, 122.9660],
  
  // Labo
  "labo municipal hall": [14.1550, 122.8310],
  "lgu labo": [14.1550, 122.8310],
  
  // Jose Panganiban
  "jose panganiban municipal hall": [14.2835, 122.6840],
  "lgu jose panganiban": [14.2835, 122.6840],

  // Mercedes
  "mercedes municipal hall": [14.1165, 123.0165],
  "lgu mercedes": [14.1165, 123.0165],

  // Vinzons
  "vinzons municipal hall": [14.1830, 122.9330],
  "lgu vinzons": [14.1830, 122.9330],

  // Paracale
  "paracale municipal hall": [14.2830, 122.7830],
  "lgu paracale": [14.2830, 122.7830],

  // San Vicente
  "san vicente municipal hall": [14.1000, 122.8660],
  "lgu san vicente": [14.1000, 122.8660],

  // Santa Elena
  "santa elena municipal hall": [14.1665, 122.4005],
  "lgu santa elena": [14.1665, 122.4005],

  // Talisay
  "talisay municipal hall": [14.1500, 122.9330],
  "lgu talisay": [14.1500, 122.9330],

  // ==========================================
  // 3. CAMARINES SUR - NAGA, PILI, IRIGA
  // ==========================================
  "naga city hall": [13.6218, 123.1832],
  "lgu naga": [13.6218, 123.1832],
  "nbp naga": [13.6235, 123.1850],
  "pili municipal hall": [13.5833, 123.2667],
  "lgu pili": [13.5833, 123.2667],
  "camarines sur eoc hub": [13.5835, 123.2670],
  "iriga city hall": [13.4189, 123.4194],
  "lgu iriga": [13.4189, 123.4194],

  // ==========================================
  // 4. CATANDUANES - VIRAC
  // ==========================================
  "virac municipal hall": [13.5833, 124.2333],
  "lgu virac": [13.5833, 124.2333],
  "nbp virac": [13.5845, 124.2340],
  "virac disaster risk office": [13.5850, 124.2350],
  "dtc catanduanes": [13.5840, 124.2335],

  // ==========================================
  // 5. SORSOGON - SORSOGON CITY
  // ==========================================
  "sorsogon city hall": [12.9744, 124.0058],
  "lgu sorsogon": [12.9744, 124.0058],
  "nbp sorsogon": [12.9750, 124.0060],
  "matnog municipal hall": [12.5850, 124.0840],
  "lgu matnog": [12.5850, 124.0840],

  // ==========================================
  // 6. MASBATE - MASBATE CITY
  // ==========================================
  "masbate city hall": [12.3705, 123.6247],
  "lgu masbate": [12.3705, 123.6247],
  "masbate port disaster sub-hub": [12.3710, 123.6260],
};

// Calculate precise coordinate for any project site
function getSiteCoordinates(site: MapSite, baseCoords: [number, number]): [number, number] {
  if (site.latitude && site.longitude && !isNaN(site.latitude) && !isNaN(site.longitude)) {
    return [site.latitude, site.longitude];
  }
  const key = `${site.siteName} ${site.barangay || ""} ${site.details || ""}`.toLowerCase();
  for (const [name, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (key.includes(name)) return coords;
  }
  // If it's an eLGU Hall, place it right at the town center coordinate
  if (site.projectId === "elgu") {
    return baseCoords;
  }
  // Deterministic distributed coordinate offset around municipality center
  const str = `${site.id}-${site.siteName}-${site.barangay || ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const dist = 0.003 + ((Math.abs(hash >> 2) % 12) / 1000); // tightly grouped 300m - 1.5km radius
  return [
    baseCoords[0] + Math.sin(angle) * dist,
    baseCoords[1] + Math.cos(angle) * dist * 1.15,
  ];
}

// Project styling configurations
const PROJECT_CONFIGS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  freewifi: { label: "Free Wi-Fi", color: "#06b6d4", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  govnet: { label: "GovNet", color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  nbp: { label: "NBP Backbone", color: "#6366f1", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
  elgu: { label: "eLGU Hall", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  cybersecurity: { label: "Cybersecurity", color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  gecs: { label: "GECS Comms", color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  ilcdb: { label: "ILCDB Center", color: "#ec4899", bg: "bg-pink-500/10", border: "border-pink-500/30" },
  pnpki: { label: "PNPKI RA", color: "#8b5cf6", bg: "bg-purple-500/10", border: "border-purple-500/30" },
};

// Create custom leaflet marker icon for specific project site
function createProjectMarkerIcon(site: MapSite, isSelected: boolean) {
  const cfg = PROJECT_CONFIGS[site.projectId] || { color: "#3b82f6" };
  const color = cfg.color;
  const size = isSelected ? 38 : 28;
  return L.divIcon({
    className: "custom-project-pin",
    html: `
      <div class="relative flex flex-col items-center justify-center cursor-pointer group" style="width: ${size}px; height: ${size}px;">
        <div class="w-full h-full rounded-full flex items-center justify-center transition-all duration-200 ${
          isSelected ? 'ring-4 ring-white scale-125 z-50' : 'group-hover:scale-115'
        }" style="background-color: ${color}; box-shadow: 0 0 ${isSelected ? '22px' : '12px'} ${color}cc;">
          <div class="w-2.5 h-2.5 rounded-full bg-slate-950/85 flex items-center justify-center">
            <div class="w-1 h-1 rounded-full bg-white"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// Overview cluster marker (Image 2 style: circular badge with count inside, sized and color-coded by density)
function createClusterMarkerIcon(count: number, isSelected: boolean = false) {
  let bgColor = "#107569"; // Dark teal default
  let borderColor = "rgba(255, 255, 255, 0.85)";
  let shadow = "0 0 14px rgba(16, 117, 105, 0.6)";
  let size = 32;
  let fontSize = "11px";

  if (count >= 100) {
    bgColor = "#581C87"; // Deep Purple (Image 2)
    borderColor = "#FFFFFF";
    shadow = "0 0 24px rgba(88, 28, 135, 0.85), 0 0 6px rgba(255, 255, 255, 0.5)";
    size = 56;
    fontSize = "16px";
  } else if (count >= 30) {
    bgColor = "#6D28D9"; // Vibrant Purple (Image 2)
    borderColor = "rgba(255, 255, 255, 0.95)";
    shadow = "0 0 20px rgba(109, 40, 217, 0.8)";
    size = 46;
    fontSize = "14px";
  } else if (count >= 15) {
    bgColor = "#1D4ED8"; // Royal Blue (Image 2)
    borderColor = "rgba(255, 255, 255, 0.9)";
    shadow = "0 0 16px rgba(29, 78, 216, 0.75)";
    size = 40;
    fontSize = "13px";
  } else if (count >= 5) {
    bgColor = "#0E7490"; // Ocean Teal
    borderColor = "rgba(255, 255, 255, 0.85)";
    shadow = "0 0 12px rgba(14, 116, 144, 0.6)";
    size = 34;
    fontSize = "12px";
  } else {
    bgColor = "#115E59"; // Dark Teal
    borderColor = "rgba(255, 255, 255, 0.8)";
    shadow = "0 0 10px rgba(17, 94, 89, 0.5)";
    size = 28;
    fontSize = "11px";
  }

  return L.divIcon({
    className: "custom-cluster-badge",
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group" style="width: ${size}px; height: ${size}px;">
        <div 
          class="w-full h-full rounded-full flex items-center justify-center transition-all duration-300 transform group-hover:scale-125 group-hover:brightness-110 ${
            isSelected ? 'ring-4 ring-white scale-125 z-50' : ''
          }" 
          style="background-color: ${bgColor}; border: 2px solid ${borderColor}; box-shadow: ${shadow};"
        >
          <span style="font-size: ${fontSize}; font-weight: 800; color: #FFFFFF; font-family: ui-monospace, monospace; line-height: 1; user-select: none;">
            ${count}
          </span>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function BicolMap() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string>("albay-legazpi");
  const [selectedProvince, setSelectedProvince] = useState<string>("Albay");
  
  const [allMapSites, setAllMapSites] = useState<MapSite[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);

  // Overview map scatter & zoom state
  const [overviewMode, setOverviewMode] = useState<"clusters" | "scattered">("clusters");
  const [activeCluster, setActiveCluster] = useState<any | null>(null);
  const [scatterFilterProject, setScatterFilterProject] = useState<string>("all");

  const allPins = useMemo(() => getAllMunicipalityPins(), []);

  const loadSites = () => {
    setIsLoadingSites(true);
    projectApi.getMapSites()
      .then((sites) => setAllMapSites(sites))
      .finally(() => setIsLoadingSites(false));
  };

  // Fetch all live database sites across Region V on mount and listen for real-time updates
  useEffect(() => {
    loadSites();
    const handleUpdate = () => {
      loadSites();
    };
    window.addEventListener("dict_records_updated", handleUpdate);
    window.addEventListener("dict_project_data_updated", handleUpdate);
    window.addEventListener("dict_freewifi_updated", handleUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleUpdate);
      window.removeEventListener("dict_project_data_updated", handleUpdate);
      window.removeEventListener("dict_freewifi_updated", handleUpdate);
    };
  }, []);

  // Spatial Clustering Engine: Groups sites into clean regional cluster bubbles (Image 2 style)
  const regionalClusters = useMemo(() => {
    if (!allMapSites || allMapSites.length === 0) return [];

    // 1. Geocode all sites
    const geocoded = allMapSites.map((s) => {
      let lat = s.latitude;
      let lng = s.longitude;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        const coords = getSiteCoordinates(s, [13.1391, 123.7438]);
        lat = coords[0];
        lng = coords[1];
      }
      return { ...s, lat, lng };
    });

    // 2. Spatial clustering with radius ~ 0.22 degrees
    const clusters: {
      id: string;
      name: string;
      province: string;
      lat: number;
      lng: number;
      count: number;
      sites: typeof geocoded;
      breakdown: Record<string, number>;
    }[] = [];

    const radius = 0.22;

    geocoded.forEach((site) => {
      let best: (typeof clusters)[0] | null = null;
      let minDist = Infinity;
      for (const c of clusters) {
        const d = Math.hypot(c.lat - site.lat, c.lng - site.lng);
        if (d < radius && d < minDist) {
          minDist = d;
          best = c;
        }
      }

      if (best) {
        best.sites.push(site);
        best.count++;
        best.lat = (best.lat * (best.count - 1) + site.lat) / best.count;
        best.lng = (best.lng * (best.count - 1) + site.lng) / best.count;
        best.breakdown[site.projectId] = (best.breakdown[site.projectId] || 0) + 1;
      } else {
        const breakdown: Record<string, number> = { [site.projectId]: 1 };
        clusters.push({
          id: `cluster-${clusters.length}`,
          name: site.municipality || `${site.province} Hub`,
          province: site.province || "Albay",
          lat: site.lat,
          lng: site.lng,
          count: 1,
          sites: [site],
          breakdown,
        });
      }
    });

    return clusters.sort((a, b) => b.count - a.count);
  }, [allMapSites]);

  // Selected Municipality for full-screen deep dive
  const activeMunicipality = useMemo(() => {
    return allPins.find((p) => p.id === selectedMunicipalityId) || allPins.find(p => p.id === "albay-legazpi") || allPins[0];
  }, [allPins, selectedMunicipalityId]);

  // Clean municipality name matcher against database records
  const municipalitySites = useMemo(() => {
    if (!activeMunicipality) return [];
    const munName = activeMunicipality.name.toLowerCase().replace("city of ", "").replace(" city", "").trim();

    return allMapSites.filter((site) => {
      const sMun = (site.municipality || "").toLowerCase().replace("city of ", "").replace(" city", "").trim();
      const sName = (site.siteName || "").toLowerCase();
      
      if (sMun === munName || sMun.includes(munName) || munName.includes(sMun)) {
        return true;
      }
      if (sName.includes(munName)) {
        return true;
      }
      return false;
    });
  }, [allMapSites, activeMunicipality]);

  // Sites with precise coordinates mapped for the Leaflet view
  const mappedMunicipalitySites = useMemo(() => {
    const baseCoords = activeMunicipality?.coordinates || [13.1391, 123.7438];
    return municipalitySites.map((site) => ({
      ...site,
      coords: getSiteCoordinates(site, baseCoords),
    }));
  }, [municipalitySites, activeMunicipality]);

  // Filtered by project type & search query in deep dive
  const filteredSites = useMemo(() => {
    return mappedMunicipalitySites.filter((site) => {
      if (selectedProjectId !== "all" && site.projectId !== selectedProjectId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = site.siteName.toLowerCase().includes(q);
        const matchBarangay = (site.barangay || "").toLowerCase().includes(q);
        const matchType = site.type.toLowerCase().includes(q);
        const matchProject = site.projectName.toLowerCase().includes(q);
        if (!matchName && !matchBarangay && !matchType && !matchProject) return false;
      }
      return true;
    });
  }, [mappedMunicipalitySites, selectedProjectId, searchQuery]);

  // Project categories breakdown count for filter chips in deep dive
  const projectBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    municipalitySites.forEach((s) => {
      counts[s.projectId] = (counts[s.projectId] || 0) + 1;
    });
    return counts;
  }, [municipalitySites]);

  // Sites scattered in overview map when a cluster is clicked
  const scatteredOverviewSites = useMemo(() => {
    if (!activeCluster) return [];
    const base = [activeCluster.lat, activeCluster.lng] as [number, number];
    return activeCluster.sites.map((site: any) => ({
      ...site,
      coords: getSiteCoordinates(site, base),
    }));
  }, [activeCluster]);

  const filteredScatteredOverviewSites = useMemo(() => {
    if (!scatteredOverviewSites) return [];
    if (scatterFilterProject === "all") return scatteredOverviewSites;
    return scatteredOverviewSites.filter((s: any) => s.projectId === scatterFilterProject);
  }, [scatteredOverviewSites, scatterFilterProject]);

  // Center & zoom calculation for overview map
  const overviewCenterCoords = useMemo<[number, number]>(() => {
    if (overviewMode === "scattered" && activeCluster) {
      return [activeCluster.lat, activeCluster.lng];
    }
    return [13.45, 123.35];
  }, [overviewMode, activeCluster]);

  const overviewZoomLevel = overviewMode === "scattered" ? 13 : 8;

  // Center & zoom for full-screen modal
  const mapCenterCoords = useMemo<[number, number]>(() => {
    if (activeSiteId) {
      const target = mappedMunicipalitySites.find((s) => s.id === activeSiteId);
      if (target) return target.coords;
    }
    return activeMunicipality?.coordinates || [13.1391, 123.7438];
  }, [activeSiteId, mappedMunicipalitySites, activeMunicipality]);

  // Handle clicking a cluster bubble on overview map -> Zooms in & Scatters the data!
  const handleClusterClick = (cluster: any) => {
    setActiveCluster(cluster);
    setOverviewMode("scattered");
    setScatterFilterProject("all");
  };

  // Reset from scattered view back to overview clusters
  const handleResetToClusters = () => {
    setOverviewMode("clusters");
    setActiveCluster(null);
    setScatterFilterProject("all");
  };

  // Open full-screen deep dive drawer
  const handleOpenDeepDive = (munName?: string, prov?: string) => {
    if (munName) {
      const matched = allPins.find((p) => p.name.toLowerCase().includes(munName.toLowerCase()) || munName.toLowerCase().includes(p.name.toLowerCase()));
      if (matched) {
        setSelectedMunicipalityId(matched.id);
        setSelectedProvince(matched.province);
      }
    }
    setSelectedProjectId("all");
    setSearchQuery("");
    setActiveSiteId(null);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. OVERVIEW MAP WIDGET ON DASHBOARD (IMAGE 2 STYLE)       */}
      {/* ========================================================= */}
      <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#07090E] select-none">
        <div className="flex-1 relative">
          <MapContainer
            center={overviewCenterCoords}
            zoom={overviewZoomLevel}
            style={{ height: "100%", width: "100%", background: "#07090E" }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            
            <MapFlyController center={overviewCenterCoords} zoom={overviewZoomLevel} />

            {/* A. CLUSTER MODE: Clean circular bubble badges matching Image 2 */}
            {overviewMode === "clusters" &&
              regionalClusters.map((cluster) => {
                const isSelected = activeCluster?.id === cluster.id;
                return (
                  <Marker
                    key={cluster.id}
                    position={[cluster.lat, cluster.lng]}
                    icon={createClusterMarkerIcon(cluster.count, isSelected)}
                    eventHandlers={{
                      click: (e) => {
                        e.originalEvent.stopPropagation();
                        handleClusterClick(cluster);
                      },
                    }}
                  >
                    <Popup className="custom-cluster-popup">
                      <div className="p-3 min-w-[210px] bg-[#0C1220] text-slate-200 rounded-xl shadow-2xl border border-slate-700/60">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider">
                            {cluster.province}
                          </span>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {cluster.count} Total
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-white mb-2">{cluster.name}</h4>

                        {/* Breakdown pills */}
                        <div className="space-y-1 text-[11px] pt-2 border-t border-slate-800">
                          {cluster.breakdown.freewifi && (
                            <div className="flex justify-between items-center text-cyan-400 font-medium">
                              <span>📡 Free Wi-Fi</span>
                              <span className="font-mono font-bold">{cluster.breakdown.freewifi} sites</span>
                            </div>
                          )}
                          {cluster.breakdown.elgu && (
                            <div className="flex justify-between items-center text-emerald-400 font-medium">
                              <span>🏛️ eLGU Systems</span>
                              <span className="font-mono font-bold">{cluster.breakdown.elgu} LGUs</span>
                            </div>
                          )}
                          {cluster.breakdown.cybersecurity && (
                            <div className="flex justify-between items-center text-amber-400 font-medium">
                              <span>🛡️ Cybersecurity</span>
                              <span className="font-mono font-bold">{cluster.breakdown.cybersecurity} feeds</span>
                            </div>
                          )}
                          {cluster.breakdown.pnpki && (
                            <div className="flex justify-between items-center text-purple-400 font-medium">
                              <span>🔑 PNPKI RAs</span>
                              <span className="font-mono font-bold">{cluster.breakdown.pnpki} units</span>
                            </div>
                          )}
                          {cluster.breakdown.govnet && (
                            <div className="flex justify-between items-center text-blue-400 font-medium">
                              <span>🌐 GovNet Nodes</span>
                              <span className="font-mono font-bold">{cluster.breakdown.govnet} nodes</span>
                            </div>
                          )}
                          {cluster.breakdown.ilcdb && (
                            <div className="flex justify-between items-center text-pink-400 font-medium">
                              <span>🎓 ILCDB Batches</span>
                              <span className="font-mono font-bold">{cluster.breakdown.ilcdb} sessions</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleClusterClick(cluster)}
                          className="w-full mt-3 py-1.5 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Scatter & View Projects</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

            {/* B. SCATTERED MODE: Individual colored project markers when clicked */}
            {overviewMode === "scattered" &&
              filteredScatteredOverviewSites.map((site: any) => {
                const cfg = PROJECT_CONFIGS[site.projectId] || { color: "#3b82f6" };
                return (
                  <Marker
                    key={site.id}
                    position={site.coords}
                    icon={createProjectMarkerIcon(site, false)}
                  >
                    <Popup className="custom-project-popup">
                      <div className="p-2.5 min-w-[220px] bg-[#0C1220] text-slate-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}
                          >
                            {site.projectName}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400">
                            {site.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-white leading-snug">{site.siteName}</h4>
                        {site.barangay && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {site.barangay}, {site.municipality}
                          </p>
                        )}
                        <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] font-mono text-slate-300">
                          {site.details}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-800/60 flex justify-between items-center">
                          <Link
                            to={`/projects/${site.projectId}`}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                          >
                            <span>View Module</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                          <button
                            onClick={() => handleOpenDeepDive(site.municipality, site.province)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                          >
                            Full Table →
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>

          {/* Floating HUD Controller for Scattered View */}
          {overviewMode === "scattered" && activeCluster && (
            <div className="absolute top-3 left-3 right-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToClusters}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shrink-0"
                  title="Return to Regional Clusters overview"
                >
                  <span>← Overview</span>
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">{activeCluster.name}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                      {activeCluster.count} Sites
                    </span>
                  </div>
                </div>
              </div>

              {/* Scatter Project Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full sm:w-auto py-0.5">
                <button
                  onClick={() => setScatterFilterProject("all")}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    scatterFilterProject === "all"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  All ({activeCluster.count})
                </button>
                {Object.entries(activeCluster.breakdown).map(([pId, c]: any) => {
                  const cfg = PROJECT_CONFIGS[pId] || { label: pId, color: "#3B82F6" };
                  const isSel = scatterFilterProject === pId;
                  return (
                    <button
                      key={pId}
                      onClick={() => setScatterFilterProject(pId)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1"
                      style={{
                        backgroundColor: isSel ? `${cfg.color}` : `${cfg.color}15`,
                        color: isSel ? "#FFFFFF" : cfg.color,
                        border: `1px solid ${cfg.color}40`,
                      }}
                    >
                      <span>{cfg.label}</span>
                      <span className="font-mono font-black">({c})</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => handleOpenDeepDive(activeCluster.name, activeCluster.province)}
                  className="px-2.5 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold whitespace-nowrap ml-1 flex items-center gap-1 cursor-pointer"
                >
                  <span>Table View</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ENLARGED PROVINCE & PROJECT SITES DEEP-DIVE MODAL      */}
      {/* ========================================================= */}
      {isModalOpen && activeMunicipality && (
        <div className="fixed inset-0 z-[9999] bg-[#070D18] flex flex-col lg:flex-row overflow-hidden animate-in fade-in duration-150">
          
          {/* LEFT: Leaflet Map with Precise Coordinates (65%) */}
          <div className="relative flex-1 h-[50vh] lg:h-full bg-[#080B12] overflow-hidden border-b lg:border-b-0 lg:border-r border-[#172033]">
            
            {/* Red Circular Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 z-[1000] w-11 h-11 rounded-full bg-[#EF4444] hover:bg-red-600 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
              title="Close modal and return to dashboard"
              aria-label="Close"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>

            {/* Top Coordinates & Location Indicator Overlay */}
            <div className="absolute top-5 left-5 z-[1000] bg-[#0C1220]/90 backdrop-blur-md border border-[#1E2E4E] rounded-xl p-3 shadow-xl max-w-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  {activeMunicipality.name} Deployment Map
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-300 mt-1 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>
                  {activeMunicipality.coordinates[0].toFixed(4)}° N, {activeMunicipality.coordinates[1].toFixed(4)}° E
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Showing <strong className="text-emerald-400 font-mono">{filteredSites.length}</strong> site{filteredSites.length === 1 ? "" : "s"} with coordinates from database
              </div>
            </div>

            {/* Leaflet Map Canvas */}
            <MapContainer
              center={mapCenterCoords}
              zoom={13}
              style={{ height: "100%", width: "100%", background: "#080B12" }}
              zoomControl={true}
              attributionControl={false}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={17}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={17}
              />
              <MapFlyController center={mapCenterCoords} zoom={activeSiteId ? 15 : 13} />

              {/* Render ALL Project Markers in this Municipality */}
              {filteredSites.map((site) => {
                const isSelected = site.id === activeSiteId;
                const cfg = PROJECT_CONFIGS[site.projectId] || { color: "#3b82f6" };
                return (
                  <Marker
                    key={site.id}
                    position={site.coords}
                    icon={createProjectMarkerIcon(site, isSelected)}
                    eventHandlers={{
                      click: () => setActiveSiteId(site.id),
                    }}
                  >
                    <Popup className="custom-project-popup">
                      <div className="p-2.5 min-w-[240px] bg-[#0C1220] text-slate-200 rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span 
                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono"
                            style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}
                          >
                            {site.projectName}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {site.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-white leading-snug">{site.siteName}</h4>
                        {site.barangay && (
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            {site.barangay}, {site.municipality}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-300">
                          {site.details}
                        </div>
                        <div className="mt-1 text-[9px] text-slate-500 font-mono">
                          GPS: {site.coords[0].toFixed(5)}, {site.coords[1].toFixed(5)}
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-slate-800/60">
                          <Link
                            to={`/projects/${site.projectId}`}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                          >
                            <span>Open {site.projectName} module</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* RIGHT: Projects List & Deep-Dive Panel (35%) */}
          <div className="w-full lg:w-[480px] xl:w-[520px] h-[50vh] lg:h-full bg-[#0B111E] border-l border-[#172033] flex flex-col overflow-hidden">
            
            {/* Panel Header */}
            <div className="p-5 border-b border-[#1E293B] bg-[#070B14]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  {activeMunicipality.province} Province
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {municipalitySites.length} Live DB Records
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1.5 tracking-tight">
                {activeMunicipality.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{activeMunicipality.coordinates[0].toFixed(4)}° N, {activeMunicipality.coordinates[1].toFixed(4)}° E</span>
              </p>

              {/* Search input */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeMunicipality.name} sites, schools, facilities...`}
                  className="w-full bg-[#111726] border border-[#1E293B] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Project Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar mt-3 pb-1">
                <button
                  onClick={() => setSelectedProjectId("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedProjectId === "all"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                      : "bg-[#131E33] text-slate-300 hover:bg-[#1C2A44] hover:text-white"
                  }`}
                >
                  All ({municipalitySites.length})
                </button>
                {Object.entries(projectBreakdown).map(([pId, count]) => {
                  const cfg = PROJECT_CONFIGS[pId] || { label: pId };
                  const isSel = selectedProjectId === pId;
                  return (
                    <button
                      key={pId}
                      onClick={() => setSelectedProjectId(pId)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        isSel
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-[#131E33] text-slate-300 hover:bg-[#1C2A44] hover:text-white"
                      }`}
                    >
                      {cfg.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Project Sites List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2.5">
              {filteredSites.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-white">No projects found matching query</p>
                  <p className="text-[11px] text-slate-500 mt-1">Try clearing your search or filter</p>
                </div>
              ) : (
                filteredSites.map((site) => {
                  const isSelected = site.id === activeSiteId;
                  const cfg = PROJECT_CONFIGS[site.projectId] || { color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/30", label: site.projectName };
                  return (
                    <div
                      key={site.id}
                      onClick={() => setActiveSiteId(site.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#151E33] border-blue-500 ring-1 ring-blue-500/50 shadow-lg shadow-blue-950/40"
                          : "bg-[#0E1524] border-[#1C2840] hover:border-slate-700 hover:bg-[#121B2E]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}35` }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                            {site.type}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {site.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white mt-1.5 leading-snug">
                        {site.siteName}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          {site.barangay ? `${site.barangay}, ${site.municipality}` : site.municipality}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {site.coords[0].toFixed(3)}, {site.coords[1].toFixed(3)}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#1C2840]/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-mono">
                          {site.details}
                        </span>
                        <Link
                          to={`/projects/${site.projectId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
