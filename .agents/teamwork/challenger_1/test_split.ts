import { splitSignerNameToLines } from "../../../server/services/pnpkiSigningService";

const longName = "ANNABEL-C-ODOÑO-CALIMPONG-AND-A-VERY-LONG-NAME-THAT-SHOULD-BE-SPLIT-PROPERLY";
const lines = splitSignerNameToLines(longName, 20);
console.log("Lines:", lines);
