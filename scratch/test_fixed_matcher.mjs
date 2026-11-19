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

// Stop words that must never trigger name matches
const COMMON_STOP_WORDS = new Set([
  "THE", "AND", "FOR", "NOT", "BUT", "ALL", "ANY", "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT",
  "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY", "WHO",
  "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "DATE", "SIGN", "NAME", "PAGE",
  "OFFICE", "STAFF", "HEAD", "NOTE", "NOTED", "TRUE", "TIME", "RECORD", "WORK", "CIVIL", "SERVICE",
  "FORM", "DAILY", "HOURS", "DAYS", "MONTH", "YEAR", "CHECK", "TOTAL", "ORIGINAL", "DIGITAL", "FORMAT",
  "PREPARED", "CERTIFIED", "CORRECT", "REGIONAL", "DIRECTOR", "ADMINISTRATIVE", "OFFICER", "BUDGET"
]);

export function matchNames(a, b) {
  if (!a || !b) return false;
  const s1 = normalize(a);
  const s2 = normalize(b);
  if (s1 === s2) return true;

  // Direct phrase inclusion with word boundaries (minimum 5 chars to avoid "DE", "DY", etc. matching inside words)
  if (s1.length >= 6 && new RegExp(`(^|\\s)${escapeRegex(s2)}(\\s|$)`, "i").test(s1)) return true;
  if (s2.length >= 6 && new RegExp(`(^|\\s)${escapeRegex(s1)}(\\s|$)`, "i").test(s2)) return true;

  const t1 = s1.split(" ").filter((w) => w.length >= 2 && !COMMON_STOP_WORDS.has(w));
  const t2 = s2.split(" ").filter((w) => w.length >= 2 && !COMMON_STOP_WORDS.has(w));
  if (t1.length === 0 || t2.length === 0) return false;

  const common = t1.filter((w) => t2.includes(w));

  // If both have 2+ name tokens (e.g. "LEAH DY" and "DY LEAH BALDERAMA"), require at least 2 common tokens
  if (t1.length >= 2 && t2.length >= 2) {
    return common.length >= 2;
  }

  // If one has only 1 token (e.g. single surname "CALIMPONG"), it must be at least 4 letters and match exactly
  if (t1.length === 1 && t2.length >= 1) {
    return t1[0].length >= 4 && t2.includes(t1[0]);
  }
  if (t2.length === 1 && t1.length >= 1) {
    return t2[0].length >= 4 && t1.includes(t2[0]);
  }

  return false;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      // 1. Exact full normalized name match
      if (snippet === normUName) return true;

      // 2. Full normalized name appears as exact phrase inside snippet
      if (normUName.length >= 5 && new RegExp(`(^|\\s)${escapeRegex(normUName)}(\\s|$)`, "i").test(snippet)) {
        return true;
      }

      // 3. Multi-part match: For names with >= 2 significant tokens (e.g. "ANNABEL" + "CALIMPONG", or "KEN" + "LEON"),
      // all significant parts must be present as whole words in the snippet.
      if (uParts.length >= 2) {
        const allPartsPresent = uParts.every((part) =>
          new RegExp(`(^|\\s)${escapeRegex(part)}(\\s|$)`, "i").test(snippet)
        );
        if (allPartsPresent) return true;

        // Or First Name + Last Name present (e.g. "ANNABEL" and "CALIMPONG" even if middle "ODONO" varies)
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

const users = [
  { name: "Annabel C. Odoño-Calimpong", role: "Regional Director" },
  { name: "DE LEON, KEN MATTHEW L.", role: "ISA I" },
  { name: "Leah B. Dy", role: "Chief Administrative Officer" },
  { name: "Ace Malto", role: "Super Admin" },
  { name: "Danrev A. Balana", role: "Budget Staff" }
];

const candidateTexts = [
  "The",
  "ORIGINAL",
  "of this",
  "DOCUMENT",
  "is in",
  "DIGITAL FORMAT",
  "Prepared by:",
  "Certified Correct by:",
  "Noted by:",
  "DANREV A. BALANA",
  "CARLA MAE R. CABREDO",
  "LEAH B. DY",
  "ANNABEL C. ODOÑO-CALIMPONG",
  "Budget Staff",
  "Budget Officer",
  "Chief Administrative Officer",
  "OIC-Regional Director, Regional Office No. V",
  "DTR_ANNABEL_C__ODO_O_CALIMPONG.pdf",
  "Scanned from document: ANNABEL C. ODOÑO-CALIMPONG"
];

const matched = detectMatchingUsersFromText(candidateTexts, users);
console.log('Tested Results:');
matched.forEach(m => console.log('✓ Matched:', m.name));
console.log('Did Ken De Leon match?', matched.some(m => m.name.includes('LEON')));
