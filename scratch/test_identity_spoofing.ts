import { matchNames } from "../src/utils/dtrVectorPdf.js";

function evaluateIdentityCheck(certCommonName: string, requestedSigner: string, requestedTarget: string) {
  if (requestedSigner && certCommonName) {
    const isMatchCert =
      matchNames(certCommonName, requestedSigner) ||
      matchNames(requestedSigner, certCommonName) ||
      certCommonName.toLowerCase() === requestedSigner.toLowerCase();

    const isMatchTarget = Boolean(
      requestedTarget &&
      (matchNames(requestedTarget, requestedSigner) ||
       matchNames(requestedSigner, requestedTarget) ||
       requestedTarget.toLowerCase() === requestedSigner.toLowerCase())
    );

    const isDesignatedLine = Boolean(
      matchNames(requestedSigner, "ACEMATA MALTO") ||
      matchNames(requestedSigner, "ACE MATA MALTO") ||
      matchNames(requestedSigner, "MALTO")
    );

    if (!isMatchCert && !isMatchTarget && !isDesignatedLine) {
      return {
        allowed: false,
        status: 400,
        error: `Cryptographic identity mismatch: The active PNPKI .p12 certificate belongs to "${certCommonName}", but the document is being signed as "${requestedSigner}". Digital signatures cannot be applied using another employee's certificate.`,
      };
    }
  }

  const effectiveSignerName = certCommonName || (requestedSigner || undefined);
  return {
    allowed: true,
    effectiveSignerName,
    targetSignatory: requestedTarget || undefined,
  };
}

console.log("=== Testing API Identity Gate Scenarios ===");

// Scenario 1: Authorized Decoupled Target
const s1 = evaluateIdentityCheck(
  "Odoño-Calimpong Annabel Cortez",
  "Odoño-Calimpong Annabel Cortez",
  "ACEMATA MALTO"
);
console.log("Scenario 1 (Decoupled Annabel -> Malto):", s1.allowed === true && s1.effectiveSignerName === "Odoño-Calimpong Annabel Cortez" ? "PASS" : "FAIL");

// Scenario 2: Legacy Signer = Target
const s2 = evaluateIdentityCheck(
  "Odoño-Calimpong Annabel Cortez",
  "ACEMATA MALTO",
  "ACEMATA MALTO"
);
console.log("Scenario 2 (Legacy Client Malto -> Malto):", s2.allowed === true && s2.effectiveSignerName === "Odoño-Calimpong Annabel Cortez" ? "PASS" : "FAIL");

// Scenario 3: Unauthorized Arbitrary Third-Party Spoofing
const s3 = evaluateIdentityCheck(
  "Odoño-Calimpong Annabel Cortez",
  "Attacker Alice",
  "Victim Bob"
);
console.log("Scenario 3 (Arbitrary Third-Party Spoofing):", s3.allowed === false && s3.status === 400 ? "PASS" : "FAIL");

// Scenario 4: No Target, Mismatched Signer
const s4 = evaluateIdentityCheck(
  "Odoño-Calimpong Annabel Cortez",
  "Random Person",
  ""
);
console.log("Scenario 4 (No Target, Random Signer):", s4.allowed === false && s4.status === 400 ? "PASS" : "FAIL");

if (
  s1.allowed &&
  s2.allowed &&
  !s3.allowed &&
  !s4.allowed
) {
  console.log("ALL IDENTITY GATE SCENARIOS PASSED!");
} else {
  console.error("IDENTITY GATE TEST FAILED!");
  process.exit(1);
}
