import forge from "node-forge";

export interface P12SignerIdentity {
  commonName: string;
  subjectDN: string;
  organization?: string;
  issuerCN?: string;
  issuerDN?: string;
  serialNumber?: string;
  sha256Fingerprint: string;
  validFrom: string;
  validTo: string;
  caChainCount: number;
}

export interface PersonnelSettingsProfile {
  employeeName: string;
  designation: string;
  station: string;
  province: string;
  contactNumber: string;
  email: string;
  supervisorName: string;
  supervisorTitle: string;
  otcUsername: string;
  otcPassword?: string;
  signatureImage: string | null;
  p12Filename?: string | null;
  p12Filesize?: number;
  p12Base64?: string | null;
  p12Password?: string;
  isP12Unlocked?: boolean;
  savePasswordToDb?: boolean;
  signerIdentity?: P12SignerIdentity | null;
}

export const INITIAL_PERSONNEL_SETTINGS_PROFILE: PersonnelSettingsProfile = {
  employeeName: "",
  designation: "",
  station: "Region V (Bicol)",
  province: "Albay",
  contactNumber: "",
  email: "",
  supervisorName: "DIR. CARMELITA H. CENTENO",
  supervisorTitle: "Regional Director, DICT Region V",
  otcUsername: "",
  otcPassword: "",
  signatureImage: null,
  p12Filename: null,
  p12Filesize: 0,
  p12Base64: null,
  p12Password: "",
  isP12Unlocked: false,
  savePasswordToDb: true,
  signerIdentity: null,
};

/**
 * Format a Date object or ISO string to authentic PNPKI digital signature timestamp format:
 * e.g. "2026.11.05 14:30:15 +08'00'"
 */
export function formatPnpkiDate(dateInput: Date | string = new Date()): string {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${year}.${month}.${day} ${hours}:${minutes}:${seconds} +08'00'`;
  } catch {
    return String(dateInput);
  }
}

export type P12InspectionResult =
  | { success: true; identity: P12SignerIdentity; error?: string }
  | { success: false; error: string; identity?: undefined };

/**
 * Parses and verifies a PKCS#12 (.p12 / .pfx) certificate keystore using pure JavaScript (node-forge).
 * Extracts cryptographic signer identity, certificate chain, issuer, and SHA-256 fingerprint.
 */
export function inspectP12Keystore(
  p12Base64: string,
  password: string = ""
): P12InspectionResult {
  try {
    const cleanBase64 = p12Base64.replace(/^data:.*?;base64,/, "").trim();
    if (!cleanBase64) {
      return { success: false, error: "Empty certificate data provided." };
    }

    const p12Der = forge.util.decode64(cleanBase64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password || "");

    // Extract certificate bags and private key bags
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const keyBags =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ||
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ||
      [];

    if (keyBags.length === 0 || !keyBags[0]?.key) {
      return {
        success: false,
        error: "Could not find valid Private Key in this .p12 keystore. Please verify your password.",
      };
    }

    const privateKey: any = keyBags[0].key;
    let signerCert: forge.pki.Certificate | null = null;
    let caChainCount = 0;

    for (const bag of certBags) {
      if (bag.cert) {
        const pub: any = bag.cert.publicKey;
        if (
          privateKey.n &&
          pub?.n &&
          privateKey.n.compareTo(pub.n) === 0 &&
          privateKey.e.compareTo(pub.e) === 0
        ) {
          signerCert = bag.cert;
        } else {
          caChainCount++;
        }
      }
    }

    if (!signerCert && certBags.length > 0 && certBags[0].cert) {
      signerCert = certBags[0].cert;
    }

    if (!signerCert) {
      return {
        success: false,
        error: "Could not find a valid certificate matching the private key in this .p12 file.",
      };
    }

    // Extract Common Name (CN)
    const cnAttr = signerCert.subject.attributes.find(
      (a: any) => a.name === "commonName" || a.shortName === "CN"
    );
    const commonName = cnAttr ? String(cnAttr.value) : "DICT Authorized Signatory";

    // Extract Organization (O)
    const orgAttr = signerCert.subject.attributes.find(
      (a: any) => a.name === "organizationName" || a.shortName === "O"
    );
    const organization = orgAttr ? String(orgAttr.value) : undefined;

    // Extract Issuer CN
    const issuerCnAttr = signerCert.issuer.attributes.find(
      (a: any) => a.name === "commonName" || a.shortName === "CN"
    );
    const issuerCN = issuerCnAttr ? String(issuerCnAttr.value) : undefined;

    // Formatted DNs
    const subjectDN = signerCert.subject.attributes
      .map((a: any) => `${a.shortName || a.name}=${a.value}`)
      .join(", ");
    const issuerDN = signerCert.issuer.attributes
      .map((a: any) => `${a.shortName || a.name}=${a.value}`)
      .join(", ");

    // Calculate SHA-256 certificate fingerprint
    const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(signerCert)).getBytes();
    const sha256Hex = forge.md.sha256.create().update(certDerBytes).digest().toHex();
    const sha256Fingerprint = (sha256Hex.match(/.{2}/g) || []).join(":").toUpperCase();

    // Validity dates
    const validFrom = signerCert.validity.notBefore.toISOString();
    const validTo = signerCert.validity.notAfter.toISOString();

    return {
      success: true,
      identity: {
        commonName,
        subjectDN,
        organization,
        issuerCN,
        issuerDN,
        serialNumber: signerCert.serialNumber,
        sha256Fingerprint,
        validFrom,
        validTo,
        caChainCount: certBags.length,
      },
    };
  } catch (err: any) {
    const msg = err?.message || "Failed to inspect .p12 certificate";
    if (msg.includes("MAC") || msg.includes("password") || msg.includes("Invalid")) {
      return { success: false, error: "Incorrect .p12 password or corrupted keystore." };
    }
    return { success: false, error: msg };
  }
}
