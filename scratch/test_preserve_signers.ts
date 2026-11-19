import { recheckDocWithLatestUsers } from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

const doc = {
  id: "test-doc-1",
  fileName: "138_Memo_2026_342_Request_for_Fund_Download_Jan_Mar2026_NSD_Amangca (1).pdf",
  targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG",
  requiredSigners: ["ANNABEL C. ODOÑO-CALIMPONG"],
  signers: [
    {
      name: "ANNABEL C. ODOÑO-CALIMPONG",
      role: "Regional Director",
      status: "pending",
      position: "above"
    }
  ],
  scannedInfo: null // simulate scannedInfo being null from DB
};

const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
const { updatedDoc } = recheckDocWithLatestUsers(doc, freshUsers);
console.log("Updated requiredSigners:", updatedDoc.requiredSigners);
console.log("Updated signers:", updatedDoc.signers);
