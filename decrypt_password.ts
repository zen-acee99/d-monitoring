import { decryptP12Password } from "./server/services/pnpkiSigningService";
import crypto from "crypto";

// The service uses this key:
const ENCRYPTION_KEY = crypto.scryptSync(
  "dict-r5-pnpki-signing-vault-key-2026",
  "dict-pnpki-salt",
  32
);

const encrypted = "enc:73a8ca8230b8a1a9030ff253:00660fe7494709b94b9d1a3eeee46b04:ed94390e0a5bcab4744f19e4d1";
const password = decryptP12Password(encrypted);
console.log("Decrypted password:", password);
