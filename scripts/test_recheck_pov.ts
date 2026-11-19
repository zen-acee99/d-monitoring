import { normalizeNameForMatch, matchNames, detectMatchingUsersFromText } from '../src/utils/dtrVectorPdf';

function testRecheck(doc: any, latestUsers: any[]) {
  const candidateTexts: string[] = [];
  if (doc.scannedInfo?.detectedTexts && Array.isArray(doc.scannedInfo.detectedTexts)) {
    candidateTexts.push(...doc.scannedInfo.detectedTexts);
  }
  if (doc.scannedInfo?.signers && Array.isArray(doc.scannedInfo.signers)) {
    candidateTexts.push(...doc.scannedInfo.signers.map((s: any) => s.name));
  }
  if (doc.signers && Array.isArray(doc.signers)) {
    candidateTexts.push(...doc.signers.map((s: any) => s.name));
  }
  if (doc.fileName) candidateTexts.push(doc.fileName);

  const matchedUsers = detectMatchingUsersFromText(candidateTexts, latestUsers);

  const validSignerNames = new Set(matchedUsers.map((u) => normalizeNameForMatch(u.name)));
  if (doc.scannedInfo?.signers && Array.isArray(doc.scannedInfo.signers)) {
    doc.scannedInfo.signers.forEach((s: any) => {
      if (s?.name) validSignerNames.add(normalizeNameForMatch(s.name));
    });
  }
  if (doc.signers && Array.isArray(doc.signers)) {
    doc.signers.forEach((s: any) => {
      if (s?.name) validSignerNames.add(normalizeNameForMatch(s.name));
    });
  }

  const nextRequired = [...(doc.requiredSigners || [])];
  const nextSigners = [...(doc.signers || [])];

  for (const u of matchedUsers) {
    const cleanName = u.name.toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, "").trim();
    const alreadyInReq = nextRequired.some(
      (r: string) => matchNames(r, cleanName) || normalizeNameForMatch(r) === normalizeNameForMatch(cleanName)
    );
    const existingSigner = nextSigners.find(
      (s: any) => matchNames(s.name, cleanName) || normalizeNameForMatch(s.name) === normalizeNameForMatch(cleanName)
    );
    const isSigned = existingSigner?.status === "signed";

    if (!alreadyInReq) {
      nextRequired.push(cleanName);
    }
    if (!existingSigner) {
      nextSigners.push({
        name: cleanName,
        role: u.role || "Signatory",
        status: isSigned ? "signed" : "pending",
        position: "above",
      });
    }
  }

  for (const s of nextSigners) {
    if (s?.name) {
      const cleanName = s.name.toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, "").trim();
      const inReq = nextRequired.some(
        (r: string) => matchNames(r, cleanName) || normalizeNameForMatch(r) === normalizeNameForMatch(cleanName)
      );
      if (!inReq) {
        const inUsers = latestUsers.some((u) => matchNames(u.name, cleanName));
        if (inUsers) {
          nextRequired.push(cleanName);
        }
      }
    }
  }

  const filteredRequired = nextRequired.filter((req) => {
    const norm = normalizeNameForMatch(req);
    const isDetectedInDoc =
      validSignerNames.has(norm) ||
      Array.from(validSignerNames).some((vn) => matchNames(vn, req));
    if (!isDetectedInDoc) return false;
    const isRegistered = latestUsers.some(
      (u) => matchNames(u.name, req) || normalizeNameForMatch(u.name) === norm
    );
    if (!isRegistered) return false;
    return true;
  });

  const deduplicatedRequired: string[] = [];
  const seenReq = new Set<string>();
  for (const r of filteredRequired) {
    const norm = normalizeNameForMatch(r);
    if (!seenReq.has(norm)) {
      seenReq.add(norm);
      deduplicatedRequired.push(r);
    }
  }

  const deduplicatedSigners: any[] = [];
  const seenSig = new Set<string>();
  for (const s of nextSigners) {
    const norm = normalizeNameForMatch(s.name);
    if (!seenSig.has(norm)) {
      seenSig.add(norm);
      deduplicatedSigners.push(s);
    }
  }

  return {
    requiredSigners: deduplicatedRequired,
    signers: deduplicatedSigners
  };
}

const testDoc = {
  id: "test-pov-0111",
  fileName: "POV_2026_11_0111_Vehicle_Rental_for_the_House_of_Representativessigned.pdf",
  targetPersonnel: "Annabel C. Odoño-Calimpong",
  requiredSigners: [],
  signers: [
    {
      name: "Annabel C. Odoño-Calimpong",
      role: "Signatory",
      status: "signed",
      position: "above"
    }
  ],
  scannedInfo: {
    primaryPersonnel: "",
    requiredSigners: [],
    signers: [],
    detectedTexts: ["Date", "Amount              :", "ORS/BURS No. :"]
  }
};

const users = [
  { name: "Annabel C. Odoño-Calimpong", role: "Regional Director", email: "annabel.calimpong@dict.gov.ph" },
  { name: "Leah B. Dy", role: "Chief Administrative Officer", email: "leah.dy@dict.gov.ph" }
];

const res = testRecheck(testDoc, users);
console.log("Updated doc requiredSigners:", res.requiredSigners);
console.log("Updated doc signers:", res.signers);
const signedCount = res.signers.filter(s => s.status === 'signed').length;
console.log(`Badge: ${signedCount} of ${res.requiredSigners.length} Signed`);
