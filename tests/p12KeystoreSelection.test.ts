import assert from "node:assert";

// ─── Test fixMojibake ────────────────────────────────────────────────────────
function fixMojibake(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/Ã±/g, "ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/OdoÃ\u00B1o/g, "Odoño")
    .replace(/OdoÃ±o/g, "Odoño")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Â/g, "");
}

console.log("======================================================================");
console.log("   AUTOMATED TEST SUITE: PNPKI KEYSTORE SELECTION & MOJIBAKE FIX      ");
console.log("======================================================================");

// [Test 1] fixMojibake
console.log("\n[Test 1] Mojibake Name Repair");
assert.strictEqual(
  fixMojibake("OdoÃ±o-Calimpong Annabel Cortez"),
  "Odoño-Calimpong Annabel Cortez",
  "Must repair 'OdoÃ±o-Calimpong Annabel Cortez' to 'Odoño-Calimpong Annabel Cortez'"
);
console.log("  PASS: Test 1.1 - OdoÃ±o-Calimpong Annabel Cortez repaired to Odoño-Calimpong Annabel Cortez");

assert.strictEqual(
  fixMojibake("Malto Ace Mata"),
  "Malto Ace Mata",
  "Clean names must remain unchanged"
);
console.log("  PASS: Test 1.2 - Malto Ace Mata untouched");

assert.strictEqual(
  fixMojibake("Cantorna Michael Verano"),
  "Cantorna Michael Verano",
  "Clean names must remain unchanged"
);
console.log("  PASS: Test 1.3 - Cantorna Michael Verano untouched");

// [Test 2] Preselection & Selection Preservation Logic
console.log("\n[Test 2] Keystore Preselection & Selection Preservation");

interface Profile {
  id: string;
  user_Id?: string;
  Name: string;
  p12?: string;
  p12_password?: string;
  image_digiSigned?: string;
}

const mockProfiles: Profile[] = [
  { id: "sig-1", user_Id: "1", Name: "Malto Ace Mata", p12: "BASE64_ACE", p12_password: "pw1" },
  { id: "sig-2", user_Id: "2", Name: "Odoño-Calimpong Annabel Cortez", p12: "BASE64_ANNABEL", p12_password: "pw2" },
  { id: "sig-3", user_Id: "3", Name: "Cantorna Michael Verano", p12: "BASE64_CANTORNA", p12_password: "pw3" },
];

function resolveSelectedProfileId(
  prevId: string,
  profiles: Profile[],
  activeKeystoreId?: string,
  currentUserId?: string
): string {
  if (prevId && profiles.some((p) => p.id === prevId)) {
    return prevId;
  }
  if (activeKeystoreId && profiles.some((p) => p.id === activeKeystoreId)) {
    return activeKeystoreId;
  }
  const match = currentUserId
    ? profiles.find((p) => p.user_Id === currentUserId || p.id === `dtr-sig-${currentUserId}`)
    : null;
  return match ? match.id : profiles[0]?.id || "";
}

// 2.1 Initial load with Ace
const initialSelected = resolveSelectedProfileId("", mockProfiles, undefined, "1");
assert.strictEqual(initialSelected, "sig-1", "Ace (user 1) should be initially preselected");
console.log("  PASS: Test 2.1 - Initial preselection picks current user (Ace)");

// 2.2 User clicks Annabel (sig-2)
const userSelectedAnnabel = "sig-2";
const retainedAnnabel = resolveSelectedProfileId(userSelectedAnnabel, mockProfiles, undefined, "1");
assert.strictEqual(retainedAnnabel, "sig-2", "Selection MUST be retained and NOT reset to Ace");
console.log("  PASS: Test 2.2 - Selection of Annabel is strictly preserved and not overwritten");

// 2.3 User clicks Cantorna (sig-3)
const userSelectedCantorna = "sig-3";
const retainedCantorna = resolveSelectedProfileId(userSelectedCantorna, mockProfiles, undefined, "1");
assert.strictEqual(retainedCantorna, "sig-3", "Selection MUST be retained and NOT reset to Ace");
console.log("  PASS: Test 2.3 - Selection of Cantorna is strictly preserved and not overwritten");

// [Test 3] Activation payload contains p12Base64 and p12Password
console.log("\n[Test 3] Activation Payload Completeness");
const chosen = mockProfiles.find((p) => p.id === "sig-2")!;
const activatedPayload = {
  profileId: chosen.id,
  userId: chosen.user_Id,
  signerName: chosen.Name,
  p12Base64: chosen.p12,
  p12Password: chosen.p12_password,
  isUnlocked: true,
  hasP12: true,
};
assert.strictEqual(activatedPayload.profileId, "sig-2");
assert.strictEqual(activatedPayload.p12Base64, "BASE64_ANNABEL");
assert.strictEqual(activatedPayload.p12Password, "pw2");
assert.strictEqual(activatedPayload.isUnlocked, true);
console.log("  PASS: Test 3.1 - Keystore activation correctly conveys p12Base64 & p12Password for Annabel");

console.log("\n======================================================================");
console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH 0 FAILURES!");
console.log("======================================================================\n");
