import { db } from '../server/db';
import { normalizeNameForMatch, matchNames } from '../src/utils/dtrVectorPdf';

// Simulated fixed recheck function
function fixedRecheckDocWithLatestUsers(doc: any, latestUsers: any[]) {
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

  const matchedUsers = latestUsers.filter(u => candidateTexts.some(ct => matchNames(ct, u.name)));

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

  const filteredRequired = nextRequired.filter((req) => {
    const norm = normalizeNameForMatch(req);
    const isAlreadySigned = doc.signers?.some((s: any) => matchNames(s.name, req) && (s.status === "signed" || s.isAlreadySigned));
    if (isAlreadySigned) return true; // NEVER delete already-signed signers!

    const isSpuriousCandidate =
      norm.includes("DE LEON") ||
      norm.includes("KEN MATTHEW") ||
      norm.includes("ACE MALTO") ||
      norm === "ACE" ||
      norm === "MALTO";
    if (isSpuriousCandidate) {
      const genuineTexts = doc.scannedInfo?.detectedTexts || [];
      const isAuthentic = genuineTexts.some((dt: string) => {
        return matchNames(dt, req) || normalizeNameForMatch(dt).includes("MALTO") || normalizeNameForMatch(dt).includes("DE LEON");
      });
      if (!isAuthentic) return false;
    }

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

  const filteredSigners = nextSigners.filter((s: any) => {
    return filteredRequired.some((req: string) => matchNames(req, s.name));
  });

  return {
    updatedDoc: {
      ...doc,
      requiredSigners: filteredRequired,
      signers: filteredSigners,
    }
  };
}

async function main() {
  const res = await db.execute("SELECT * FROM signing_workspace_documents WHERE id = 'doc-upload-1794277438673-0-d1i5'");
  const row = res.rows[0];
  const doc = {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    targetPersonnel: row.target_personnel,
    requiredSigners: JSON.parse(row.required_signers as string),
    signers: JSON.parse(row.signers_matrix as string),
    scannedInfo: row.scanned_info ? JSON.parse(row.scanned_info as string) : null,
  };

  const userRows = await db.execute("SELECT id, name, role, email FROM users");
  const testUsers = userRows.rows.map((u: any) => ({ name: u.name, role: u.role, email: u.email }));

  const resFixed = fixedRecheckDocWithLatestUsers(doc, testUsers);
  console.log("Fixed recheck result:", {
    requiredSigners: resFixed.updatedDoc.requiredSigners,
    signers: resFixed.updatedDoc.signers,
  });
}

main();
