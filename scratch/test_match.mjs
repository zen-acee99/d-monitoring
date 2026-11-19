export function normalizeNameForMatch(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?|MS\.?|MR\.?)\s+/i, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function matchNames(a, b) {
  if (!a || !b) return false;
  const clean = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/gi, "n")
      .toLowerCase()
      .replace(/\.p12$/i, "")
      .replace(/\.pfx$/i, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const s1 = clean(a);
  const s2 = clean(b);
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const t1 = s1.split(" ").filter((w) => w.length >= 2);
  const t2 = s2.split(" ").filter((w) => w.length >= 2);
  if (t1.length === 0 || t2.length === 0) return false;
  const common = t1.filter((w) => t2.includes(w));
  return (
    common.length >= 2 ||
    (t1.length === 1 && t2.includes(t1[0])) ||
    (t2.length === 1 && t1.includes(t2[0]))
  );
}

export function detectMatchingUsersFromText(candidateTexts, userList) {
  if (!candidateTexts || candidateTexts.length === 0 || !userList || userList.length === 0) {
    return [];
  }

  const matched = [];
  const normalizedSnippets = candidateTexts
    .map((t) => (typeof t === "string" ? normalizeNameForMatch(t) : ""))
    .filter((t) => t.length >= 3);

  for (const u of userList) {
    if (!u.name || u.name.trim().length < 3) continue;
    const normUName = normalizeNameForMatch(u.name);
    const uParts = normUName.split(/\s+/).filter((p) => p.length > 2);

    const directMatch = normalizedSnippets.some((snippet) => {
      if (snippet === normUName || snippet.includes(normUName)) return true;
      if (uParts.length >= 2 && uParts.every((part) => snippet.includes(part))) return true;
      if (matchNames(snippet, u.name)) return true;
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

const user = { name: "DE LEON, KEN MATTHEW L.", role: "Staff" };

// What could be the text in a DTR PDF?
const dtrSnippets = [
  "CIVIL SERVICE FORM NO. 48",
  "DAILY TIME RECORD",
  "DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY",
  "REGION V - BICOL",
  "ANNABEL C. ODOÑO-CALIMPONG",
  "OIC-Regional Director",
  "Verified as to prescribed office hours:",
  "IN CHARGE",
  "For the month of October 2026",
  "Official hours for arrival and departure",
  "Regular days",
  "Saturdays",
  "I certify on my honor that the above is a true and correct report of the hours of work performed...",
  "DTR_ANNABEL_C_ODO_O_CALIMPONG.pdf"
];

for (const snippet of dtrSnippets) {
  const m = detectMatchingUsersFromText([snippet], [user]);
  if (m.length > 0) {
    console.log(`MATCHED on snippet: "${snippet}"`);
  }
}
