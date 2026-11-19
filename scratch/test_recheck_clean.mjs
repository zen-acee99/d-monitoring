import fs from 'fs';
import { createClient } from '@libsql/client/web';
import dotenv from 'dotenv';
dotenv.config();

function normalize(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?|MS\.?|MR\.?)\s+/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const COMMON_STOP_WORDS = new Set([
  "THE", "AND", "FOR", "NOT", "BUT", "ALL", "ANY", "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT",
  "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO",
  "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "DATE", "SIGN", "NAME", "PAGE",
  "OFFICE", "STAFF", "HEAD", "NOTE", "NOTED", "TRUE", "TIME", "RECORD", "WORK", "CIVIL", "SERVICE",
  "FORM", "DAILY", "HOURS", "DAYS", "MONTH", "YEAR", "CHECK", "TOTAL", "ORIGINAL", "DIGITAL", "FORMAT",
  "PREPARED", "CERTIFIED", "CORRECT", "REGIONAL", "DIRECTOR", "ADMINISTRATIVE", "OFFICER", "BUDGET"
]);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchNames(a, b) {
  if (!a || !b) return false;
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1 === s2) return true;

  if (s1.length >= 6 && new RegExp(`(^|\\s)${escapeRegex(s2)}(\\s|$)`, "i").test(s1)) return true;
  if (s2.length >= 6 && new RegExp(`(^|\\s)${escapeRegex(s1)}(\\s|$)`, "i").test(s2)) return true;

  const t1 = s1.split(" ").filter((w) => w.length >= 2 && !COMMON_STOP_WORDS.has(w));
  const t2 = s2.split(" ").filter((w) => w.length >= 2 && !COMMON_STOP_WORDS.has(w));
  if (t1.length === 0 || t2.length === 0) return false;

  const common = t1.filter((w) => t2.includes(w));

  if (t1.length >= 2 && t2.length >= 2) {
    return common.length >= 2;
  }

  if (t1.length === 1 && t2.length >= 1) {
    return t1[0].length >= 4 && t2.includes(t1[0]);
  }
  if (t2.length === 1 && t1.length >= 1) {
    return t2[0].length >= 4 && t1.includes(t2[0]);
  }

  return false;
}

export function detectMatchingUsersFromText(candidateTexts, userList) {
  if (!candidateTexts || candidateTexts.length === 0 || !userList || userList.length === 0) {
    return [];
  }

  const matched = [];
  const normalizedSnippets = candidateTexts
    .map((t) => (typeof t === "string" ? normalize(t) : ""))
    .filter((t) => t.length >= 3);

  for (const u of userList) {
    if (!u.name || u.name.trim().length < 3) continue;
    const normUName = normalize(u.name);
    const uParts = normUName.split(/\s+/).filter((p) => p.length > 2 && !COMMON_STOP_WORDS.has(p));
    if (uParts.length === 0) continue;

    const directMatch = normalizedSnippets.some((snippet) => {
      if (snippet === normUName) return true;
      if (normUName.length >= 5 && new RegExp(`(^|\\s)${escapeRegex(normUName)}(\\s|$)`, "i").test(snippet)) {
        return true;
      }
      if (uParts.length >= 2) {
        const allPartsPresent = uParts.every((part) =>
          new RegExp(`(^|\\s)${escapeRegex(part)}(\\s|$)`, "i").test(snippet)
        );
        if (allPartsPresent) return true;

        const first = uParts[0];
        const last = uParts[uParts.length - 1];
        if (first.length >= 3 && last.length >= 3 && first !== last) {
          const firstRegex = new RegExp(`(^|\\s)${escapeRegex(first)}(\\s|$)`, "i");
          const lastRegex = new RegExp(`(^|\\s)${escapeRegex(last)}(\\s|$)`, "i");
          if (firstRegex.test(snippet) && lastRegex.test(snippet)) {
            return true;
          }
        }
      }
      return false;
    });

    if (directMatch) {
      if (!matched.some((m) => m.name.toLowerCase() === u.name.toLowerCase())) {
        matched.push(u);
      }
    }
  }

  return matched;
}

export function recheckDocWithLatestUsers(doc, latestUsers) {
  if (!doc || !latestUsers || latestUsers.length === 0) {
    return { updatedDoc: doc, hasNewRecognition: false, newlyDetectedNames: [] };
  }

  const candidateTexts = [];
  if (doc.scannedInfo?.detectedTexts && Array.isArray(doc.scannedInfo.detectedTexts)) {
    candidateTexts.push(...doc.scannedInfo.detectedTexts);
  }
  if (doc.scannedInfo?.signers && Array.isArray(doc.scannedInfo.signers)) {
    candidateTexts.push(...doc.scannedInfo.signers.map((s) => s.name));
  }
  if (doc.fileName) candidateTexts.push(doc.fileName);
  if (doc.notes) candidateTexts.push(doc.notes);
  if (doc.targetPersonnel) candidateTexts.push(doc.targetPersonnel);

  const matchedUsers = detectMatchingUsersFromText(candidateTexts, latestUsers);

  // Set of names actually found in document texts or scanned signatories
  const validSignerNames = new Set(matchedUsers.map((u) => normalize(u.name)));
  if (doc.scannedInfo?.signers && Array.isArray(doc.scannedInfo.signers)) {
    doc.scannedInfo.signers.forEach((s) => {
      if (s?.name) validSignerNames.add(normalize(s.name));
    });
  }

  let hasNewRecognition = false;
  const newlyDetectedNames = [];
  const nextRequired = [...(doc.requiredSigners || [])];
  const nextSigners = [...(doc.signers || [])];

  for (const u of matchedUsers) {
    const cleanName = u.name.toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, "").trim();
    const alreadyInReq = nextRequired.some(
      (r) => matchNames(r, cleanName) || normalize(r) === normalize(cleanName)
    );
    const existingSigner = nextSigners.find(
      (s) => matchNames(s.name, cleanName) || normalize(s.name) === normalize(cleanName)
    );
    const isSigned = existingSigner?.status === "signed";

    if (!alreadyInReq) {
      hasNewRecognition = true;
      newlyDetectedNames.push(cleanName);
      if (!isSigned) {
        nextRequired.push(cleanName);
      }
      nextSigners.push({
        name: cleanName,
        role: u.role || "Signatory",
        status: isSigned ? "signed" : "pending",
        position: "above",
      });
    }
  }

  const isRaod = (doc.fileName || "").toUpperCase().includes("RAOD");
  const filteredRequired = nextRequired.filter((req) => {
    const norm = normalize(req);

    // Must be genuinely detected in the document
    const isDetectedInDoc = validSignerNames.has(norm) ||
      Array.from(validSignerNames).some((vn) => matchNames(vn, req));
    if (!isDetectedInDoc) return false;

    // Must be registered in active User List
    const isRegistered = latestUsers.some(
      (u) => matchNames(u.name, req) || normalize(u.name) === norm
    );
    if (!isRegistered) return false;

    if (isRaod) {
      const isKnownRaodSigner =
        norm.includes("CALIMPONG") ||
        norm.includes("ANNABEL") ||
        norm.includes("DY") ||
        norm.includes("LEAH");
      if (!isKnownRaodSigner) return false;
    }

    const sObj = nextSigners.find(
      (s) => matchNames(s.name, req) || normalize(s.name) === norm
    );
    if (sObj?.status === "signed") {
      const hasOtherPending = nextSigners.some((s) => s.status === "pending" && !matchNames(s.name, req));
      if (hasOtherPending) return false;
    }

    return true;
  });

  const filteredSigners = nextSigners.filter((s) => {
    const norm = normalize(s.name);
    const isDetected = validSignerNames.has(norm) ||
      Array.from(validSignerNames).some((vn) => matchNames(vn, s.name));
    if (!isDetected) return false;
    const isReg = latestUsers.some((u) => matchNames(u.name, s.name) || normalize(u.name) === norm);
    if (!isReg) return false;
    if (isRaod && !norm.includes("CALIMPONG") && !norm.includes("ANNABEL") && !norm.includes("DY") && !norm.includes("LEAH")) {
      return false;
    }
    return true;
  });

  if (filteredRequired.length !== nextRequired.length || filteredSigners.length !== nextSigners.length) {
    hasNewRecognition = true;
    nextRequired.length = 0;
    nextRequired.push(...filteredRequired);
    nextSigners.length = 0;
    nextSigners.push(...filteredSigners);
  }

  let nextTarget = doc.targetPersonnel;
  const isPlaceholderTarget =
    !nextTarget ||
    nextTarget.toUpperCase() === "PERSONNEL" ||
    nextTarget.toUpperCase() === "USER" ||
    nextTarget.toUpperCase() === "UNKNOWN USER" ||
    (isRaod && (nextTarget.toUpperCase().includes("ACE") || nextTarget.toUpperCase().includes("MALTO") || nextTarget.toUpperCase().includes("DE LEON"))) ||
    nextTarget.toUpperCase().includes("DE LEON");

  if (filteredRequired.length > 0 && (isPlaceholderTarget || !filteredRequired.includes(nextTarget))) {
    nextTarget = filteredRequired[0];
    hasNewRecognition = true;
  }

  const updatedDoc = {
    ...doc,
    targetPersonnel: nextTarget,
    requiredSigners: nextRequired,
    signers: nextSigners,
  };

  return { updatedDoc, hasNewRecognition, newlyDetectedNames };
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute("SELECT id, pdf_filename, remarks FROM dtr_storage WHERE id = 'doc-upload-1793951259505-99-wpd8'");
const rawDoc = JSON.parse(res.rows[0].remarks);
rawDoc.id = res.rows[0].id;
rawDoc.fileName = res.rows[0].pdf_filename;

const userStore = fs.readFileSync('src/data/userStore.ts', 'utf8');
const userMatches = userStore.match(/name:\s*["']([^"']+)["']/g) || [];
const users = userMatches.map(m => {
  const name = m.replace(/name:\s*["']/, '').replace(/["']$/, '');
  return { name, role: 'Staff' };
});

const result = recheckDocWithLatestUsers(rawDoc, users);
console.log('--- RECHECK RESULT ---');
console.log('hasNewRecognition:', result.hasNewRecognition);
console.log('requiredSigners:', result.updatedDoc.requiredSigners);
console.log('signers count:', result.updatedDoc.signers.length);
console.log('signers names:', result.updatedDoc.signers.map(s => s.name));
console.log('targetPersonnel:', result.updatedDoc.targetPersonnel);
console.log('Does requiredSigners have DE LEON?', result.updatedDoc.requiredSigners.some(r => r.includes('DE LEON')));
