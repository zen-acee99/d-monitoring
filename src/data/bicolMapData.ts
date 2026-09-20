import { ELGU_LGUS_DATA, LguRecord } from "./elguData";
import { FREE_WIFI_SITES } from "./freewifiData";

export interface MunicipalityPin {
  id: string;
  name: string;
  fullName: string;
  province: "Albay" | "Camarines Sur" | "Camarines Norte" | "Catanduanes" | "Masbate" | "Sorsogon";
  coordinates: [number, number];
  status: "Live" | "Build UP" | "UAT" | "Inactive" | "No System" | "Own System";
  statusColor: string;
  version: string;
  isKeyCity: boolean;
  activeProjects: {
    freewifiCount: number;
    hasGovnet: boolean;
    hasEgovph: boolean;
    hasPnpki: boolean;
    hasCybersecurity: boolean;
    hasDtc: boolean;
  };
}

// Precise coordinates for Bicol municipalities and cities
export const MUNICIPALITY_COORDINATES: Record<string, [number, number]> = {
  // Albay
  "albay-legazpi": [13.1391, 123.7438],
  "albay-tabaco": [13.3592, 123.7317],
  "albay-ligao": [13.2421, 123.5350],
  "albay-daraga": [13.1517, 123.6961],
  "albay-camalig": [13.1667, 123.6667],
  "albay-guinobatan": [13.1900, 123.6000],
  "albay-jovellar": [13.0711, 123.6014],
  "albay-manito": [13.1217, 123.8711],
  "albay-bacacay": [13.2936, 123.7911],
  "albay-malinao": [13.4078, 123.6931],
  "albay-tiwi": [13.4560, 123.6820],
  "albay-malilipot": [13.3150, 123.7461],
  "albay-sto-domingo": [13.2344, 123.7744],
  "albay-libon": [13.3000, 123.4333],
  "albay-oas": [13.2575, 123.4967],
  "albay-polangui": [13.2933, 123.4853],
  "albay-pio-duran": [12.9833, 123.4500],
  "albay-rapu-rapu": [13.1833, 124.1250],

  // Sorsogon
  "sorsogon-sorsogon-city": [12.9744, 124.0058],
  "sorsogon-juban": [12.8472, 123.9883],
  "sorsogon-casiguran": [12.8714, 124.0086],
  "sorsogon-gubat": [12.9189, 124.1242],
  "sorsogon-barcelona": [12.8683, 124.1417],
  "sorsogon-bulusan": [12.7533, 124.1350],
  "sorsogon-iroshin": [12.7050, 124.0350],
  "sorsogon-matnog": [12.5850, 124.0840],
  "sorsogon-magallanes": [12.8317, 123.8350],
  "sorsogon-castilla": [12.9550, 123.8767],
  "sorsogon-pilar": [12.9267, 123.6750],
  "sorsogon-donsol": [12.9067, 123.5983],
  "sorsogon-bacon": [13.0378, 124.0417],
  "sorsogon-bulan": [12.6700, 123.8750],
  "sorsogon-prieto-diaz": [13.0450, 124.1933],
  "sorsogon-santa-magdalena": [12.6483, 124.1083],

  // Camarines Sur
  "camsur-naga": [13.6218, 123.1832],
  "camsur-iriga": [13.4189, 123.4194],
  "camsur-pili": [13.5833, 123.2667],
  "camsur-baao": [13.4500, 123.3667],
  "camsur-balatan": [13.3167, 123.2333],
  "camsur-bato": [13.3556, 123.3667],
  "camsur-buhi": [13.4333, 123.5167],
  "camsur-bula": [13.4667, 123.2833],
  "camsur-cabusao": [13.7167, 123.0500],
  "camsur-calabanga": [13.7083, 123.1833],
  "camsur-camaligan": [13.6167, 123.1667],
  "camsur-canaman": [13.6500, 123.1667],
  "camsur-caramoan": [13.7667, 123.8667],
  "camsur-del-gallego": [13.9167, 122.6000],
  "camsur-gainza": [13.6167, 123.1333],
  "camsur-garchitorena": [13.8833, 123.7000],
  "camsur-goa": [13.7000, 123.4833],
  "camsur-lagonoy": [13.7333, 123.5167],
  "camsur-libmanan": [13.7000, 123.0667],
  "camsur-lupi": [13.7833, 122.9000],
  "camsur-magarao": [13.6667, 123.1833],
  "camsur-milaor": [13.6000, 123.1833],
  "camsur-mina-albac": [13.5667, 123.1833],
  "camsur-nabua": [13.4000, 123.3667],
  "camsur-ocampa": [13.5667, 123.3833],
  "camsur-pamplona": [13.5833, 123.1000],
  "camsur-pasacao": [13.5167, 123.0333],
  "camsur-presentacion": [13.7167, 123.7333],
  "camsur-ragay": [13.8167, 122.7833],
  "camsur-sagñay": [13.6000, 123.5167],
  "camsur-san-fernando": [13.5667, 123.1500],
  "camsur-san-jose": [13.7000, 123.5167],
  "camsur-sipocot": [13.7667, 122.9833],
  "camsur-siruma": [14.0167, 123.2333],
  "camsur-tigaon": [13.6333, 123.5000],
  "camsur-tinambac": [13.8167, 123.3167],

  // Camarines Norte
  "camnorte-daet": [14.1130, 122.9553],
  "camnorte-basud": [14.0667, 122.9667],
  "camnorte-capalonga": [14.3333, 122.5000],
  "camnorte-jose-panganiban": [14.2833, 122.6833],
  "camnorte-labo": [14.1500, 122.8333],
  "camnorte-mercedes": [14.1167, 123.0167],
  "camnorte-paracale": [14.2833, 122.7833],
  "camnorte-san-lorenzo-ruiz": [14.0833, 122.8833],
  "camnorte-san-vicente": [14.1000, 122.8667],
  "camnorte-santa-elena": [14.1667, 122.4000],
  "camnorte-talisay": [14.1500, 122.9333],
  "camnorte-vinzons": [14.1833, 122.9333],

  // Catanduanes
  "catanduanes-virac": [13.5833, 124.2333],
  "catanduanes-bagamanoc": [13.9333, 124.2833],
  "catanduanes-baras": [13.6833, 124.3667],
  "catanduanes-bato": [13.6000, 124.2833],
  "catanduanes-caramoran": [13.9000, 124.1333],
  "catanduanes-gigmoto": [13.7833, 124.3833],
  "catanduanes-pandan": [14.0500, 124.1667],
  "catanduanes-panganiban": [13.9000, 124.3000],
  "catanduanes-san-andres": [13.6000, 124.1000],
  "catanduanes-san-miguel": [13.6500, 124.3000],
  "catanduanes-viga": [13.8833, 124.3000],

  // Masbate
  "masbate-masbate-city": [12.3705, 123.6247],
  "masbate-aroroy": [12.5167, 123.4000],
  "masbate-baleno": [12.4500, 123.5167],
  "masbate-balud": [12.0333, 123.1833],
  "masbate-batuan": [12.4167, 123.7833],
  "masbate-cataingan": [11.9667, 123.9833],
  "masbate-cawayan": [11.9333, 123.7500],
  "masbate-claveria": [12.9000, 123.2333],
  "masbate-dimasalang": [12.1833, 123.8333],
  "masbate-esperanza": [11.7333, 124.0333],
  "masbate-mandaon": [12.2333, 123.2833],
  "masbate-milagros": [12.2167, 123.5000],
  "masbate-mobo": [12.3333, 123.6833],
  "masbate-monreal": [12.6333, 123.6500],
  "masbate-palanas": [12.1667, 123.9167],
  "masbate-pio-v-corpuz": [11.8833, 124.0500],
  "masbate-placer": [11.8833, 123.9167],
  "masbate-san-fernando": [12.4833, 123.7500],
  "masbate-san-jacinto": [12.5667, 123.7333],
  "masbate-san-pascual": [13.1333, 122.9833],
  "masbate-uson": [12.2167, 123.7833],
};

// Province centers for zooming in
export const PROVINCE_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  "Albay": { center: [13.20, 123.68], zoom: 11 },
  "Sorsogon": { center: [12.86, 123.98], zoom: 11 },
  "Camarines Sur": { center: [13.58, 123.28], zoom: 10 },
  "Camarines Norte": { center: [14.15, 122.88], zoom: 11 },
  "Catanduanes": { center: [13.78, 124.23], zoom: 11 },
  "Masbate": { center: [12.28, 123.55], zoom: 10 },
};

// List of Key Hubs shown on the initial Regional Map (Image 2)
export const KEY_REGIONAL_CITIES = [
  { id: "albay-legazpi", name: "LEGAZPI", fullName: "City of Legazpi, Albay", province: "Albay" as const, coordinates: [13.1391, 123.7438] as [number, number], status: "operational" as const },
  { id: "albay-tabaco", name: "Tabaco City", fullName: "City of Tabaco, Albay", province: "Albay" as const, coordinates: [13.3592, 123.7317] as [number, number], status: "operational" as const },
  { id: "albay-ligao", name: "LIGAO", fullName: "City of Ligao, Albay", province: "Albay" as const, coordinates: [13.2421, 123.5350] as [number, number], status: "operational" as const },
  { id: "camsur-naga", name: "NAGA", fullName: "City of Naga, Camarines Sur", province: "Camarines Sur" as const, coordinates: [13.6218, 123.1832] as [number, number], status: "operational" as const },
  { id: "camsur-pili", name: "Pili", fullName: "Municipality of Pili, Camarines Sur", province: "Camarines Sur" as const, coordinates: [13.5833, 123.2667] as [number, number], status: "operational" as const },
  { id: "camsur-iriga", name: "Iriga City", fullName: "City of Iriga, Camarines Sur", province: "Camarines Sur" as const, coordinates: [13.4189, 123.4194] as [number, number], status: "operational" as const },
  { id: "camnorte-daet", name: "Daet", fullName: "Municipality of Daet, Camarines Norte", province: "Camarines Norte" as const, coordinates: [14.1130, 122.9553] as [number, number], status: "warning" as const },
  { id: "catanduanes-virac", name: "Virac", fullName: "Municipality of Virac, Catanduanes", province: "Catanduanes" as const, coordinates: [13.5833, 124.2333] as [number, number], status: "operational" as const },
  { id: "sorsogon-sorsogon-city", name: "Sorsogon City", fullName: "City of Sorsogon, Sorsogon", province: "Sorsogon" as const, coordinates: [12.9744, 124.0058] as [number, number], status: "operational" as const },
  { id: "sorsogon-matnog", name: "Matnog", fullName: "Municipality of Matnog, Sorsogon", province: "Sorsogon" as const, coordinates: [12.5850, 124.0840] as [number, number], status: "operational" as const },
  { id: "masbate-masbate-city", name: "Masbate City", fullName: "City of Masbate, Masbate", province: "Masbate" as const, coordinates: [12.3705, 123.6247] as [number, number], status: "warning" as const },
];

// Helper to assemble full municipality pins
export function getAllMunicipalityPins(): MunicipalityPin[] {
  return ELGU_LGUS_DATA.map((lgu) => {
    const coords = MUNICIPALITY_COORDINATES[lgu.id] || [13.20, 123.68];
    const isKey = KEY_REGIONAL_CITIES.some((k) => k.id === lgu.id);

    // Color logic matching Image 1:
    // Green (#10B981) for Live
    // Purple (#8B5CF6 / #7C3AED) for Own System / UAT
    // Amber / Yellow (#F59E0B) for Build UP / Inactive / Warning
    // Red (#EF4444) for No System
    let statusColor = "#10B981"; // default green
    if (lgu.status === "Live") statusColor = "#10B981";
    else if (lgu.status === "Own System") statusColor = "#8B5CF6";
    else if (lgu.status === "UAT") statusColor = "#A78BFA";
    else if (lgu.status === "Build UP") statusColor = "#3B82F6";
    else if (lgu.status === "Inactive") statusColor = "#F59E0B";
    else if (lgu.status === "No System") statusColor = "#EF4444";

    // Count free wifi sites
    const wifiMatches = FREE_WIFI_SITES.filter(
      (w) => w.municipality.toLowerCase() === lgu.name.toLowerCase() ||
             w.municipality.toLowerCase().includes(lgu.name.toLowerCase())
    );

    return {
      id: lgu.id,
      name: lgu.name,
      fullName: `${lgu.name}, ${lgu.province}`,
      province: lgu.province,
      coordinates: coords,
      status: lgu.status,
      statusColor,
      version: lgu.version && lgu.version !== "None" ? lgu.version : "N/A",
      isKeyCity: isKey,
      activeProjects: {
        freewifiCount: wifiMatches.length,
        hasGovnet: lgu.status === "Live" || isKey,
        hasEgovph: lgu.status === "Live" || lgu.status === "Own System",
        hasPnpki: lgu.status === "Live" || isKey,
        hasCybersecurity: isKey,
        hasDtc: isKey && (lgu.name.includes("Naga") || lgu.name.includes("Legazpi") || lgu.name.includes("Daet")),
      },
    };
  });
}
