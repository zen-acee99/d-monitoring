import { generateDtrVectorPdf, normalizePdfAnnotations } from "../src/utils/dtrVectorPdf";
import { signPdfBuffer, decryptP12Password, getSignerIdentityFromP12 } from "../server/services/pnpkiSigningService";
import { createClient } from "@libsql/client";
import fs from "fs";

console.log("Test bundle file created");
